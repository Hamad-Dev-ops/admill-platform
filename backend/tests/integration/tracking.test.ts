import http from "http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { DriverStatus } from "../../src/constants/driver.enum";
import { JobStatus } from "../../src/constants/job.enum";
import { UserRole } from "../../src/constants/role.enum";
import { ServiceType } from "../../src/constants/service.enum";
import { getIO, initSocket } from "../../src/config/socket";
import { cacheProvider } from "../../src/infrastructure/cache/inMemoryCache.provider";
import { sampleCacheKey } from "../../src/modules/tracking/tracking.service";
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { CustomerModel } from "../../src/models/customer.model";
import { DriverModel } from "../../src/models/driver.model";
import { FareCalculationModel } from "../../src/models/fareCalculation.model";
import { JobModel } from "../../src/models/job.model";
import { JobStatusHistoryModel } from "../../src/models/jobStatusHistory.model";
import { LocationHistoryModel } from "../../src/models/locationHistory.model";
import { NotificationModel } from "../../src/models/notification.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { ServiceModel } from "../../src/models/service.model";
import { UserModel } from "../../src/models/user.model";
import { registerSocketHandlers } from "../../src/socket";
import { connectTestDb, disconnectTestDb } from "../setup/db";
import { withDefaultCompany } from "../setup/defaultCompany";

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "7" prefix distinguishes this file's phone numbers from other test files sharing
  // the same real Atlas cluster (same defense-in-depth as job.test.ts's "6" prefix).
  return `7${runId}${phoneSeq}`;
}

const JOB_SERVICE_TYPE = ServiceType.BIKE_TOWING;

const PICKUP = { type: "Point" as const, coordinates: [55.2744, 25.1972] as [number, number] };
const DESTINATION = { type: "Point" as const, coordinates: [55.14, 25.08] as [number, number] };
const NEAR_DRIVER_LOCATION: [number, number] = [55.275, 25.198];

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m7-${tag}-${runId}@admill.test`,
    phone: uniquePhone(),
    password: "Password123!",
    role,
  };

  const res = await request(app).post("/api/v1/auth/register").send(payload);

  return {
    userId: res.body.data.user.id as string,
    accessToken: res.body.data.accessToken as string,
    email: payload.email,
  };
}

async function createCompanyForOwner(accessToken: string, tag: string) {
  const res = await request(app)
    .post("/api/v1/companies")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      companyName: `Test Recovery Co ${tag}`,
      email: `company-${tag}-${runId}@admill.test`,
      phone: uniquePhone(),
      address: "123 Sheikh Zayed Rd",
      city: "Dubai",
      country: "UAE",
      tradeLicenseNumber: `TL-${runId}-${tag}`,
      tradeLicenseExpiry: "2030-01-01",
      serviceAreas: ["Dubai"],
    });

  return res.body.data as { companyCode: string; _id: string };
}

async function registerAndApproveDriver(ownerToken: string, companyCode: string, tag: string) {
  const driver = await registerUser(UserRole.DRIVER, tag);

  const regRes = await request(app)
    .post("/api/v1/drivers")
    .set("Authorization", `Bearer ${driver.accessToken}`)
    .send({
      companyCode,
      nationalId: `NID-${runId}-${tag}`,
      emiratesId: `784-${runId}-${tag}`,
      emiratesIdExpiry: "2030-01-01",
      drivingLicenseNumber: `DL-${runId}-${tag}`,
      drivingLicenseExpiry: "2030-01-01",
    });

  const driverId = regRes.body.data._id as string;

  await request(app).patch(`/api/v1/drivers/${driverId}/approve`).set("Authorization", `Bearer ${ownerToken}`);

  return { ...driver, driverId };
}

async function setDriverLocation(accessToken: string, coordinates: [number, number]) {
  return request(app)
    .patch("/api/v1/drivers/me/location")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ location: { type: "Point", coordinates } });
}

async function setDriverStatus(accessToken: string, status: DriverStatus) {
  return request(app).patch("/api/v1/drivers/me/status").set("Authorization", `Bearer ${accessToken}`).send({ status });
}

async function makeDriverAvailableAt(accessToken: string, coordinates: [number, number]) {
  await setDriverLocation(accessToken, coordinates);
  await setDriverStatus(accessToken, DriverStatus.AVAILABLE);
}

async function ensureServiceCatalogEntry(ownerToken: string) {
  const res = await request(app)
    .post("/api/v1/services")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ serviceType: JOB_SERVICE_TYPE, displayName: "Bike Towing", baseFare: 25 });

  // 409 means a previous run already left this global catalog entry behind — fine,
  // we just reuse it (matches how the Service catalog is global, not per-company).
  if (res.status !== 201 && res.status !== 409) {
    throw new Error(`Failed to seed service catalog entry: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

// No companyId — Gap #14 resolution. POST /jobs resolves the operational
// company server-side via DEFAULT_COMPANY_CODE; each call site below wraps
// its own request with withDefaultCompany(company.companyCode).
function jobPayload() {
  return {
    serviceType: JOB_SERVICE_TYPE,
    pickupLocation: { geo: PICKUP, address: "Burj Khalifa, Dubai" },
    destinationLocation: { geo: DESTINATION, address: "Dubai Marina, Dubai" },
  };
}

async function createCompanyOwnerAndCustomer(tag: string) {
  const owner = await registerUser(UserRole.OWNER, `${tag}owner`);
  const company = await createCompanyForOwner(owner.accessToken, tag);

  const customer = await registerUser(UserRole.CUSTOMER, `${tag}customer`);
  // Registering the User (above) is not the same as registering the Customer profile
  // (Milestone 4) — JobService.create requires the latter to exist.
  await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${customer.accessToken}`)
    .send({ nationalId: `NID-CUS-${runId}-${tag}` });

  await ensureServiceCatalogEntry(owner.accessToken);
  return { owner, company, customer };
}

// Drives a job all the way to EN_ROUTE — the minimum "active job" state LocationHistory
// sampling requires (Milestone 7 Decision 2).
async function createJobEnRoute(tag: string) {
  const { owner, company, customer } = await createCompanyOwnerAndCustomer(tag);
  const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, `${tag}driver`);
  await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

  const restoreDefaultCompany = withDefaultCompany(company.companyCode);
  const jobId = await (async () => {
    try {
      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      return createRes.body.data._id as string;
    } finally {
      restoreDefaultCompany();
    }
  })();

  await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);
  await request(app)
    .patch(`/api/v1/jobs/${jobId}/status`)
    .set("Authorization", `Bearer ${driver.accessToken}`)
    .send({ status: JobStatus.EN_ROUTE });

  return { owner, company, customer, driver, jobId };
}

function waitForSocketEvent<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for socket event "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// Proves absence rather than presence — inherently needs to wait out a bounded window
// rather than resolve early, unlike every other assertion in this file.
async function expectNoSocketEvent(socket: ClientSocket, event: string, timeoutMs = 1500): Promise<void> {
  try {
    await waitForSocketEvent(socket, event, timeoutMs);
    throw new Error(`Expected no "${event}" event, but one arrived`);
  } catch (err) {
    if (!(err instanceof Error) || !/Timed out/.test(err.message)) {
      throw err;
    }
  }
}

// For fire-and-forget socket events with no ack (driver:location:update never emits
// one back) — polls real DB state until a condition is true instead of a fixed sleep,
// so the test resolves as soon as the server has actually finished processing.
async function waitUntil(check: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 100): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for condition");
}

describe("Real-Time Tracking (Milestone 7)", () => {
  let preExistingServiceIds: string[] = [];

  beforeAll(async () => {
    await connectTestDb();
    preExistingServiceIds = (await ServiceModel.find().select("_id")).map((s) => s._id.toString());
  });

  afterAll(async () => {
    const testUsers = await UserModel.find({ email: /^m7-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    const testDrivers = await DriverModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testDriverIds = testDrivers.map((d) => d._id);

    const testCustomers = await CustomerModel.find({ userId: { $in: testUserIds } }).select("_id");
    const testCustomerIds = testCustomers.map((c) => c._id);

    const testJobs = await JobModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testJobIds = testJobs.map((j) => j._id);

    await LocationHistoryModel.deleteMany({ driverId: { $in: testDriverIds } });
    await JobStatusHistoryModel.deleteMany({ jobId: { $in: testJobIds } });
    await FareCalculationModel.deleteMany({ jobId: { $in: testJobIds } });
    // Milestone 8: JobService now calls NotificationService.notify() on create/accept/
    // status-change, so this file's own test users are also Notification receivers.
    await NotificationModel.deleteMany({ receiverId: { $in: testUserIds } });
    await JobModel.deleteMany({ _id: { $in: testJobIds } });
    await CustomerModel.deleteMany({ _id: { $in: testCustomerIds } });
    await DriverModel.deleteMany({ _id: { $in: testDriverIds } });
    await CompanySettingsModel.deleteMany({ companyId: { $in: testCompanyIds } });
    await CompanyModel.deleteMany({ _id: { $in: testCompanyIds } });
    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });
    await ServiceModel.deleteMany({ _id: { $nin: preExistingServiceIds } });

    await disconnectTestDb();
  });

  describe("REST: location mutation, sampling, and GET authorization", () => {
    it("updates Driver.currentLocation in place — rapid updates overwrite rather than accumulate documents", async () => {
      const { owner, company } = await createCompanyOwnerAndCustomer("mutate");
      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "mutatedriver");

      const first = await setDriverLocation(driver.accessToken, [55.27, 25.19]);
      expect(first.status).toBe(200);
      expect(first.body.data.currentLocation.coordinates).toEqual([55.27, 25.19]);

      const second = await setDriverLocation(driver.accessToken, [55.28, 25.2]);
      expect(second.status).toBe(200);
      expect(second.body.data.currentLocation.coordinates).toEqual([55.28, 25.2]);

      // Still exactly one Driver document — an in-place field mutation, never a new
      // document per ping.
      expect(await DriverModel.countDocuments({ _id: driver.driverId })).toBe(1);

      const stored = await DriverModel.findById(driver.driverId);
      expect(stored?.currentLocation?.coordinates).toEqual([55.28, 25.2]);
    });

    it("creates no LocationHistory document while the driver has no active EN_ROUTE/STARTED job", async () => {
      const { owner, company } = await createCompanyOwnerAndCustomer("noactive");
      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "noactivedriver");

      await setDriverLocation(driver.accessToken, [55.27, 25.19]);
      await setDriverLocation(driver.accessToken, [55.271, 25.191]);
      await setDriverLocation(driver.accessToken, [55.272, 25.192]);

      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId })).toBe(0);
    });

    it("writes exactly one sampled LocationHistory record on the first EN_ROUTE ping (with the correct fields), then blocks a rapid second ping", async () => {
      const { driver, jobId } = await createJobEnRoute("sample");

      const res = await setDriverLocation(driver.accessToken, [55.276, 25.199]);
      expect(res.status).toBe(200);

      const afterFirst = await LocationHistoryModel.find({ driverId: driver.driverId });
      expect(afterFirst).toHaveLength(1);
      expect(afterFirst[0].driverId.toString()).toBe(driver.driverId);
      expect(afterFirst[0].jobId.toString()).toBe(jobId);
      expect(afterFirst[0].location.coordinates).toEqual([55.276, 25.199]);
      expect(afterFirst[0].timestamp).toBeInstanceOf(Date);

      // Rapid second ping — the sampling interval is still open, so no second row.
      await setDriverLocation(driver.accessToken, [55.2761, 25.1991]);
      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId })).toBe(1);
    });

    it("samples again once the sampling interval has elapsed", async () => {
      const { driver } = await createJobEnRoute("sampleelapsed");

      await setDriverLocation(driver.accessToken, [55.276, 25.199]);
      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId })).toBe(1);

      // Deterministically simulate "the sampling interval elapsed" instead of waiting
      // 20 real seconds — the same technique job.test.ts uses for Job.expiresAt: reach
      // into the actual internal state directly rather than depending on wall-clock time.
      const driverDoc = await DriverModel.findById(driver.driverId);
      await cacheProvider.delete(sampleCacheKey(driverDoc!._id!));

      await setDriverLocation(driver.accessToken, [55.2762, 25.1992]);
      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId })).toBe(2);
    });

    it("samples for EN_ROUTE and STARTED, but not for ACCEPTED or ARRIVED", async () => {
      const { owner, company, customer } = await createCompanyOwnerAndCustomer("gating");
      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "gatingdriver");
      await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

      const restoreDefaultCompany = withDefaultCompany(company.companyCode);
      const jobId = await (async () => {
        try {
          const createRes = await request(app)
            .post("/api/v1/jobs")
            .set("Authorization", `Bearer ${customer.accessToken}`)
            .send(jobPayload());
          return createRes.body.data._id as string;
        } finally {
          restoreDefaultCompany();
        }
      })();

      await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);

      // ACCEPTED — not yet EN_ROUTE, must not sample.
      await setDriverLocation(driver.accessToken, [55.276, 25.199]);
      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId })).toBe(0);

      await request(app)
        .patch(`/api/v1/jobs/${jobId}/status`)
        .set("Authorization", `Bearer ${driver.accessToken}`)
        .send({ status: JobStatus.EN_ROUTE });

      // EN_ROUTE — first sample fires.
      await setDriverLocation(driver.accessToken, [55.2761, 25.1991]);
      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId })).toBe(1);

      await request(app)
        .patch(`/api/v1/jobs/${jobId}/status`)
        .set("Authorization", `Bearer ${driver.accessToken}`)
        .send({ status: JobStatus.ARRIVED });

      // ARRIVED — sampling stops again, even with the interval gate force-cleared, to
      // isolate that it's the status check blocking this, not the TTL.
      const driverDoc = await DriverModel.findById(driver.driverId);
      await cacheProvider.delete(sampleCacheKey(driverDoc!._id!));
      await setDriverLocation(driver.accessToken, [55.2762, 25.1992]);
      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId })).toBe(1);

      await request(app)
        .patch(`/api/v1/jobs/${jobId}/status`)
        .set("Authorization", `Bearer ${driver.accessToken}`)
        .send({ status: JobStatus.STARTED });

      // STARTED — sampling resumes.
      await cacheProvider.delete(sampleCacheKey(driverDoc!._id!));
      await setDriverLocation(driver.accessToken, [55.2763, 25.1993]);
      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId })).toBe(2);
    }, 30000);

    it("GET /drivers/:id/location: self, owning-company owner, and the customer on an active job succeed; a stranger customer and another company's owner are rejected", async () => {
      const { owner, company, customer, driver } = await createJobEnRoute("getloc");

      const selfRes = await request(app)
        .get(`/api/v1/drivers/${driver.driverId}/location`)
        .set("Authorization", `Bearer ${driver.accessToken}`);
      expect(selfRes.status).toBe(200);
      expect(selfRes.body.data.location.coordinates).toEqual(NEAR_DRIVER_LOCATION);

      const ownerRes = await request(app)
        .get(`/api/v1/drivers/${driver.driverId}/location`)
        .set("Authorization", `Bearer ${owner.accessToken}`);
      expect(ownerRes.status).toBe(200);

      const customerRes = await request(app)
        .get(`/api/v1/drivers/${driver.driverId}/location`)
        .set("Authorization", `Bearer ${customer.accessToken}`);
      expect(customerRes.status).toBe(200);

      const otherOwner = await registerUser(UserRole.OWNER, "getlocotherowner");
      await createCompanyForOwner(otherOwner.accessToken, "getlocother");
      const otherOwnerRes = await request(app)
        .get(`/api/v1/drivers/${driver.driverId}/location`)
        .set("Authorization", `Bearer ${otherOwner.accessToken}`);
      expect(otherOwnerRes.status).toBe(403);

      const strangerCustomer = await registerUser(UserRole.CUSTOMER, "getlocstranger");
      await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${strangerCustomer.accessToken}`)
        .send({ nationalId: `NID-CUS-STRANGER-${runId}` });
      const strangerRes = await request(app)
        .get(`/api/v1/drivers/${driver.driverId}/location`)
        .set("Authorization", `Bearer ${strangerCustomer.accessToken}`);
      expect(strangerRes.status).toBe(403);
    }, 30000);
  });

  describe("Socket.IO", () => {
    let httpServer: http.Server;
    let port: number;

    beforeAll(async () => {
      httpServer = http.createServer(app);
      initSocket(httpServer);
      registerSocketHandlers();

      await new Promise<void>((resolve) => {
        httpServer.listen(0, () => resolve());
      });

      const address = httpServer.address();
      port = typeof address === "object" && address ? address.port : 0;
    });

    afterAll(async () => {
      getIO().close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });

    it("emits driver:location:changed to the subscribed customer's job room and the owner's fleet room, never to an unrelated customer", async () => {
      const { owner, customer, driver, jobId } = await createJobEnRoute("socketchanged");
      const other = await createJobEnRoute("socketother");

      const driverSocket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: driver.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(driverSocket, "connect");

      const ownerSocket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: owner.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(ownerSocket, "connect");

      const customerSocket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: customer.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(customerSocket, "connect");

      const subscribedPromise = waitForSocketEvent(customerSocket, "job:subscribed");
      customerSocket.emit("job:subscribe", jobId);
      await subscribedPromise;

      // Deliberately never subscribed to `jobId` — must never receive this driver's updates.
      const otherCustomerSocket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: other.customer.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(otherCustomerSocket, "connect");

      const customerChangedPromise = waitForSocketEvent<{ driverId: string; jobId?: string }>(
        customerSocket,
        "driver:location:changed"
      );
      const ownerChangedPromise = waitForSocketEvent<{ driverId: string }>(ownerSocket, "driver:location:changed");
      const noEventForOtherCustomer = expectNoSocketEvent(otherCustomerSocket, "driver:location:changed");

      driverSocket.emit("driver:location:update", {
        location: { type: "Point", coordinates: [55.278, 25.2] },
        speed: 30,
        heading: 100,
      });

      const [customerPayload, ownerPayload] = await Promise.all([customerChangedPromise, ownerChangedPromise]);
      await noEventForOtherCustomer;

      expect(customerPayload.driverId).toBe(driver.driverId);
      expect(customerPayload.jobId).toBe(jobId);
      expect(ownerPayload.driverId).toBe(driver.driverId);

      driverSocket.disconnect();
      ownerSocket.disconnect();
      customerSocket.disconnect();
      otherCustomerSocket.disconnect();
      // Two full createJobEnRoute flows (each now also triggering Milestone 8's
      // awaited NotificationService.notify() calls on create/accept) plus four socket
      // connections comfortably exceed the old 30s headroom — same class of
      // accumulated-real-work timeout bump job.test.ts/M4's PROGRESS.md already
      // documented, not a logic issue.
    }, 45000);

    it("persists speed, heading, and accuracy from a socket-driven ping into LocationHistory", async () => {
      const { driver, jobId } = await createJobEnRoute("socketmeta");

      const socket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: driver.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(socket, "connect");

      socket.emit("driver:location:update", {
        location: { type: "Point", coordinates: [55.277, 25.2] },
        speed: 42,
        heading: 190,
        accuracy: 8,
      });

      await waitUntil(async () => (await LocationHistoryModel.countDocuments({ driverId: driver.driverId })) > 0);
      socket.disconnect();

      const record = await LocationHistoryModel.findOne({ driverId: driver.driverId, jobId });
      expect(record?.speed).toBe(42);
      expect(record?.heading).toBe(190);
      expect(record?.accuracy).toBe(8);
    });

    it("ignores a client-supplied driverId — identity always comes from socket.user.id, so a driver cannot spoof another driver", async () => {
      const { owner, company } = await createCompanyOwnerAndCustomer("spoof");
      const driverA = await registerAndApproveDriver(owner.accessToken, company.companyCode, "spoofa");
      const driverB = await registerAndApproveDriver(owner.accessToken, company.companyCode, "spoofb");

      await setDriverLocation(driverB.accessToken, [1, 1]);

      const socketA: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: driverA.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(socketA, "connect");

      socketA.emit("driver:location:update", {
        location: { type: "Point", coordinates: [55.29, 25.21] },
        // Not part of the validated schema — must be silently ignored, never trusted.
        driverId: driverB.driverId,
      });

      await waitUntil(async () => {
        const doc = await DriverModel.findById(driverA.driverId);
        return doc?.currentLocation?.coordinates?.[0] === 55.29;
      });
      socketA.disconnect();

      const driverADoc = await DriverModel.findById(driverA.driverId);
      const driverBDoc = await DriverModel.findById(driverB.driverId);

      expect(driverADoc?.currentLocation?.coordinates).toEqual([55.29, 25.21]);
      expect(driverBDoc?.currentLocation?.coordinates).toEqual([1, 1]);
    });

    it("REST and Socket.IO ingestion share the same TrackingService logic — both mutate currentLocation and gate LocationHistory sampling identically", async () => {
      const { driver, jobId } = await createJobEnRoute("consistency");

      const restRes = await setDriverLocation(driver.accessToken, [55.28, 25.21]);
      expect(restRes.status).toBe(200);
      expect(restRes.body.data.currentLocation.coordinates).toEqual([55.28, 25.21]);
      expect(await LocationHistoryModel.countDocuments({ driverId: driver.driverId, jobId })).toBe(1);

      const driverDoc = await DriverModel.findById(driver.driverId);
      await cacheProvider.delete(sampleCacheKey(driverDoc!._id!));

      const socket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: driver.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(socket, "connect");

      socket.emit("driver:location:update", { location: { type: "Point", coordinates: [55.281, 25.211] } });

      await waitUntil(async () => (await LocationHistoryModel.countDocuments({ driverId: driver.driverId, jobId })) === 2);
      socket.disconnect();

      const finalDriverDoc = await DriverModel.findById(driver.driverId);
      expect(finalDriverDoc?.currentLocation?.coordinates).toEqual([55.281, 25.211]);

      const rows = await LocationHistoryModel.find({ driverId: driver.driverId, jobId }).sort({ timestamp: 1 });
      expect(rows).toHaveLength(2);
      expect(rows[0].location.coordinates).toEqual([55.28, 25.21]);
      expect(rows[1].location.coordinates).toEqual([55.281, 25.211]);
    }, 30000);
  });
});
