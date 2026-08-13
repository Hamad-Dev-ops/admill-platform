import http from "http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { DriverStatus } from "../../src/constants/driver.enum";
import { JobStatus } from "../../src/constants/job.enum";
import { NotificationType } from "../../src/constants/notification.enum";
import { UserRole } from "../../src/constants/role.enum";
import { ServiceType } from "../../src/constants/service.enum";
import { DevicePlatform } from "../../src/constants/device.enum";
import { getIO, initSocket } from "../../src/config/socket";
import { pushProvider } from "../../src/infrastructure/providers/push/firebase.provider";
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { CustomerModel } from "../../src/models/customer.model";
import { DeviceTokenModel } from "../../src/models/deviceToken.model";
import { DriverModel } from "../../src/models/driver.model";
import { FareCalculationModel } from "../../src/models/fareCalculation.model";
import { JobModel } from "../../src/models/job.model";
import { JobStatusHistoryModel } from "../../src/models/jobStatusHistory.model";
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
  // "8" prefix distinguishes this file's phone numbers from other test files sharing
  // the same real Atlas cluster.
  return `8${runId}${phoneSeq}`;
}

const JOB_SERVICE_TYPE = ServiceType.BIKE_TOWING;
const PICKUP = { type: "Point" as const, coordinates: [55.2744, 25.1972] as [number, number] };
const DESTINATION = { type: "Point" as const, coordinates: [55.14, 25.08] as [number, number] };
const NEAR_DRIVER_LOCATION: [number, number] = [55.275, 25.198];

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m8-${tag}-${runId}@admill.test`,
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

  if (res.status !== 201 && res.status !== 409) {
    throw new Error(`Failed to seed service catalog entry: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

// No companyId — Gap #14 resolution. POST /jobs resolves the operational
// company server-side via DEFAULT_COMPANY_CODE; createCompanyOwnerAndCustomer
// below points that env var at each test's own freshly-created company.
function jobPayload() {
  return {
    serviceType: JOB_SERVICE_TYPE,
    pickupLocation: { geo: PICKUP, address: "Burj Khalifa, Dubai" },
    destinationLocation: { geo: DESTINATION, address: "Dubai Marina, Dubai" },
  };
}

// Every job-creating test in this file goes through here, each with its own
// uniquely-tagged company — DEFAULT_COMPANY_CODE is (re)pointed at that
// company right after it's created (safe: fileParallelism:false means no
// concurrent tests). Only the *first* call's restore closure is kept — it
// captured this file's true pre-test state to restore in the outer afterAll;
// later calls' closures are intentionally discarded (see job.test.ts, the
// same pattern).
async function createCompanyOwnerAndCustomer(tag: string) {
  const owner = await registerUser(UserRole.OWNER, `${tag}owner`);
  const company = await createCompanyForOwner(owner.accessToken, tag);

  const restore = withDefaultCompany(company.companyCode);
  if (!restoreDefaultCompany) restoreDefaultCompany = restore;

  const customer = await registerUser(UserRole.CUSTOMER, `${tag}customer`);
  await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${customer.accessToken}`)
    .send({ nationalId: `NID-CUS-${runId}-${tag}` });

  await ensureServiceCatalogEntry(owner.accessToken);
  return { owner, company, customer };
}

let restoreDefaultCompany: (() => void) | null = null;

function waitForSocketEvent<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for socket event "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe("Notifications (Milestone 8)", () => {
  let preExistingServiceIds: string[] = [];

  beforeAll(async () => {
    await connectTestDb();
    preExistingServiceIds = (await ServiceModel.find().select("_id")).map((s) => s._id.toString());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    // Runs first, synchronously, so DEFAULT_COMPANY_CODE never leaks into
    // whichever test file runs next, even if the DB cleanup below throws.
    restoreDefaultCompany?.();

    const testUsers = await UserModel.find({ email: /^m8-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    const testDrivers = await DriverModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testDriverIds = testDrivers.map((d) => d._id);

    const testCustomers = await CustomerModel.find({ userId: { $in: testUserIds } }).select("_id");
    const testCustomerIds = testCustomers.map((c) => c._id);

    const testJobs = await JobModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testJobIds = testJobs.map((j) => j._id);

    await NotificationModel.deleteMany({ receiverId: { $in: testUserIds } });
    await DeviceTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await JobStatusHistoryModel.deleteMany({ jobId: { $in: testJobIds } });
    await FareCalculationModel.deleteMany({ jobId: { $in: testJobIds } });
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

  describe("REST: persistence, unread filtering, ownership", () => {
    it("persists a JOB_ACCEPTED notification for the customer, and a failed/unconfigured push never blocks the accept request", async () => {
      const { owner, company, customer } = await createCompanyOwnerAndCustomer("persist");
      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "persistdriver");
      await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      const jobId = createRes.body.data._id as string;

      // FCM is not configured in this environment (no real credentials) — this accept
      // must still succeed, proving push failure/absence never blocks the business action.
      const acceptRes = await request(app)
        .post(`/api/v1/jobs/${jobId}/accept`)
        .set("Authorization", `Bearer ${driver.accessToken}`);
      expect(acceptRes.status).toBe(200);

      const notifications = await NotificationModel.find({ receiverId: customer.userId, type: NotificationType.JOB_ACCEPTED });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toContain(acceptRes.body.data.jobNumber);
      expect(notifications[0].isRead).toBe(false);
    });

    it("filters by isRead so the unread count is queryable via meta.total, and PATCH marks a notification read (self-only)", async () => {
      const { owner, company, customer } = await createCompanyOwnerAndCustomer("unread");
      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "unreaddriver");
      await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      const jobId = createRes.body.data._id as string;

      await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);
      await request(app)
        .patch(`/api/v1/jobs/${jobId}/status`)
        .set("Authorization", `Bearer ${driver.accessToken}`)
        .send({ status: JobStatus.EN_ROUTE });
      await request(app)
        .patch(`/api/v1/jobs/${jobId}/status`)
        .set("Authorization", `Bearer ${driver.accessToken}`)
        .send({ status: JobStatus.ARRIVED });

      // Two notifications for the customer so far: JOB_ACCEPTED, DRIVER_ARRIVED.
      const unreadRes = await request(app)
        .get("/api/v1/notifications?isRead=false")
        .set("Authorization", `Bearer ${customer.accessToken}`);
      expect(unreadRes.status).toBe(200);
      expect(unreadRes.body.meta.total).toBe(2);

      const notificationId = unreadRes.body.data[0]._id as string;

      const markReadRes = await request(app)
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set("Authorization", `Bearer ${customer.accessToken}`);
      expect(markReadRes.status).toBe(200);
      expect(markReadRes.body.data.isRead).toBe(true);

      const afterReadRes = await request(app)
        .get("/api/v1/notifications?isRead=false")
        .set("Authorization", `Bearer ${customer.accessToken}`);
      expect(afterReadRes.body.meta.total).toBe(1);

      // A stranger cannot mark someone else's notification as read.
      const stranger = await registerUser(UserRole.CUSTOMER, "unreadstranger");
      const strangerRes = await request(app)
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set("Authorization", `Bearer ${stranger.accessToken}`);
      expect(strangerRes.status).toBe(403);
    }, 30000);

    it("cancellation notifies the driver when the customer cancels, and the customer when the owner cancels", async () => {
      // Customer cancels an accepted job -> the assigned driver is notified.
      const first = await createCompanyOwnerAndCustomer("cancelbycustomer");
      const driverA = await registerAndApproveDriver(first.owner.accessToken, first.company.companyCode, "cancelbycustomerdriver");
      await makeDriverAvailableAt(driverA.accessToken, NEAR_DRIVER_LOCATION);

      const createResA = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${first.customer.accessToken}`)
        .send(jobPayload());
      const jobIdA = createResA.body.data._id as string;
      await request(app).post(`/api/v1/jobs/${jobIdA}/accept`).set("Authorization", `Bearer ${driverA.accessToken}`);

      const cancelByCustomerRes = await request(app)
        .patch(`/api/v1/jobs/${jobIdA}/status`)
        .set("Authorization", `Bearer ${first.customer.accessToken}`)
        .send({ status: JobStatus.CANCELLED, cancellationReason: "changed my mind" });
      expect(cancelByCustomerRes.status).toBe(200);

      const driverNotified = await NotificationModel.findOne({
        receiverId: driverA.userId,
        type: NotificationType.JOB_CANCELLED,
      });
      expect(driverNotified).not.toBeNull();

      // Owner cancels a still-pending job (no driver assigned yet) -> the customer is notified.
      const second = await createCompanyOwnerAndCustomer("cancelbyowner");
      const createResB = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${second.customer.accessToken}`)
        .send(jobPayload());
      const jobIdB = createResB.body.data._id as string;

      const cancelByOwnerRes = await request(app)
        .patch(`/api/v1/jobs/${jobIdB}/status`)
        .set("Authorization", `Bearer ${second.owner.accessToken}`)
        .send({ status: JobStatus.CANCELLED, cancellationReason: "no drivers available" });
      expect(cancelByOwnerRes.status).toBe(200);

      const customerNotified = await NotificationModel.findOne({
        receiverId: second.customer.userId,
        type: NotificationType.JOB_CANCELLED,
      });
      expect(customerNotified).not.toBeNull();
    }, 30000);

    it("registers a device token, upserts on re-registration of the same token, and fans a push out to every one of a user's tokens", async () => {
      const { owner, company, customer } = await createCompanyOwnerAndCustomer("devicetoken");
      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "devicetokendriver");
      await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

      const tokenA = `fcm-token-a-${runId}`;
      const tokenB = `fcm-token-b-${runId}`;

      const regA = await request(app)
        .post("/api/v1/device-tokens")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ fcmToken: tokenA, platform: DevicePlatform.ANDROID });
      expect(regA.status).toBe(201);

      const regB = await request(app)
        .post("/api/v1/device-tokens")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ fcmToken: tokenB, platform: DevicePlatform.IOS });
      expect(regB.status).toBe(201);

      // Re-registering the same token again upserts — still exactly 2 documents.
      await request(app)
        .post("/api/v1/device-tokens")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ fcmToken: tokenA, platform: DevicePlatform.ANDROID });

      const tokenCount = await DeviceTokenModel.countDocuments({ userId: customer.userId });
      expect(tokenCount).toBe(2);

      const sendSpy = vi.spyOn(pushProvider, "sendToTokens");

      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      const jobId = createRes.body.data._id as string;
      await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);

      expect(sendSpy).toHaveBeenCalled();
      const [tokensArg] = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
      expect(tokensArg).toEqual(expect.arrayContaining([tokenA, tokenB]));
      expect(tokensArg).toHaveLength(2);
    }, 30000);
  });

  describe("Socket.IO: notification:new", () => {
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

    it("emits notification:new on the offered driver's own room when a job is created, and on the customer's room when it's accepted", async () => {
      const { owner, company, customer } = await createCompanyOwnerAndCustomer("socketnotify");
      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "socketnotifydriver");
      await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

      const driverSocket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: driver.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(driverSocket, "connect");

      const driverNotifiedPromise = waitForSocketEvent<{ type: string }>(driverSocket, "notification:new");

      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      const jobId = createRes.body.data._id as string;

      const driverNotification = await driverNotifiedPromise;
      expect(driverNotification.type).toBe(NotificationType.JOB_REQUEST);

      const customerSocket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: customer.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(customerSocket, "connect");

      const customerNotifiedPromise = waitForSocketEvent<{ type: string }>(customerSocket, "notification:new");

      await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);

      const customerNotification = await customerNotifiedPromise;
      expect(customerNotification.type).toBe(NotificationType.JOB_ACCEPTED);

      driverSocket.disconnect();
      customerSocket.disconnect();
    }, 30000);
  });
});
