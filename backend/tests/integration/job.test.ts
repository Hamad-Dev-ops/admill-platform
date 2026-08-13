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
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { CustomerModel } from "../../src/models/customer.model";
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
  // "6" prefix distinguishes this file's phone numbers from other test files sharing
  // the same real Atlas cluster.
  return `6${runId}${phoneSeq}`;
}

const JOB_SERVICE_TYPE = ServiceType.BIKE_TOWING;

// Burj Khalifa area — pickup.
const PICKUP = { type: "Point" as const, coordinates: [55.2744, 25.1972] as [number, number] };
// Dubai Marina area — destination, well within the same city.
const DESTINATION = { type: "Point" as const, coordinates: [55.14, 25.08] as [number, number] };
// A few hundred meters from PICKUP — inside the default 15km dispatch radius.
const NEAR_DRIVER_LOCATION: [number, number] = [55.275, 25.198];
// Abu Dhabi — ~130km from PICKUP, well outside the default 15km dispatch radius.
const FAR_DRIVER_LOCATION: [number, number] = [54.3773, 24.4539];

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m6-${tag}-${runId}@admill.test`,
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

// Makes a driver dispatch-ready in one call: approved (by registerAndApproveDriver),
// positioned, and AVAILABLE — the three preconditions findNearbyAvailable requires.
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
// company server-side via DEFAULT_COMPANY_CODE (job.service.ts's
// resolveOperationalCompany); createCompanyOwnerAndCustomer below points
// that env var at each test's own freshly-created company.
function jobPayload() {
  return {
    serviceType: JOB_SERVICE_TYPE,
    pickupLocation: { geo: PICKUP, address: "Burj Khalifa, Dubai" },
    destinationLocation: { geo: DESTINATION, address: "Dubai Marina, Dubai" },
  };
}

// Every job-creating test in this file goes through here, each with its own
// uniquely-tagged company — so DEFAULT_COMPANY_CODE is (re)pointed at that
// company right after it's created, keeping it in sync with whichever
// test is currently running (safe because vitest.config.ts's
// fileParallelism:false guarantees no concurrent tests). Only the *first*
// call's restore closure is kept (see restoreDefaultCompany below) — it's
// the one that captured this file's true pre-test state (undefined) to
// restore in the outer afterAll; the rest are intentionally discarded,
// since intermediate per-test values never need restoring individually.
async function createCompanyOwnerAndCustomer(tag: string) {
  const owner = await registerUser(UserRole.OWNER, `${tag}owner`);
  const company = await createCompanyForOwner(owner.accessToken, tag);

  const restore = withDefaultCompany(company.companyCode);
  if (!restoreDefaultCompany) restoreDefaultCompany = restore;

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

describe("Job Lifecycle & Dispatch (Milestone 6)", () => {
  let preExistingServiceIds: string[] = [];

  beforeAll(async () => {
    await connectTestDb();
    preExistingServiceIds = (await ServiceModel.find().select("_id")).map((s) => s._id.toString());
  });

  afterAll(async () => {
    // Runs first, synchronously, so it happens even if the DB cleanup below
    // throws partway through — this file's DEFAULT_COMPANY_CODE must never
    // leak into whichever test file runs next (fileParallelism:false).
    restoreDefaultCompany?.();

    const testUsers = await UserModel.find({ email: /^m6-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    const testDrivers = await DriverModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testDriverIds = testDrivers.map((d) => d._id);

    const testCustomers = await CustomerModel.find({ userId: { $in: testUserIds } }).select("_id");
    const testCustomerIds = testCustomers.map((c) => c._id);

    const testJobs = await JobModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testJobIds = testJobs.map((j) => j._id);

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

  it("creates a job, persists a FareCalculation snapshot and the initial JobStatusHistory entry, and offers only nearby AVAILABLE drivers", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("create");

    const near = await registerAndApproveDriver(owner.accessToken, company.companyCode, "createnear");
    await makeDriverAvailableAt(near.accessToken, NEAR_DRIVER_LOCATION);

    const far = await registerAndApproveDriver(owner.accessToken, company.companyCode, "createfar");
    await makeDriverAvailableAt(far.accessToken, FAR_DRIVER_LOCATION);

    const createRes = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send(jobPayload());

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.jobNumber).toMatch(/^JOB-\d{8}-\d{6}$/);
    expect(createRes.body.data.status).toBe(JobStatus.PENDING);
    expect(createRes.body.data.estimatedFare).toBeGreaterThan(0);
    expect(createRes.body.data.distanceKm).toBeGreaterThan(0);

    const jobId = createRes.body.data._id as string;

    // Only the near driver is in the offer set — the far one is outside the radius.
    const offeredIds: string[] = createRes.body.data.offeredDriverIds;
    expect(offeredIds).toContain(near.driverId);
    expect(offeredIds).not.toContain(far.driverId);

    // FareCalculation snapshot persisted, matching the job's own estimatedFare/total.
    const fareCalc = await FareCalculationModel.findOne({ jobId });
    expect(fareCalc).not.toBeNull();
    expect(fareCalc?.total).toBeCloseTo(createRes.body.data.estimatedFare, 2);
    expect(fareCalc?.factors.length).toBeGreaterThan(0);

    // Exactly one JobStatusHistory entry so far: the initial PENDING, attributed to the customer.
    const history = await JobStatusHistoryModel.find({ jobId });
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe(JobStatus.PENDING);
    expect(history[0].changedBy.toString()).toBe(customer.userId);

    // Repository persistence check — not just the API response, the actual stored document.
    const stored = await JobModel.findById(jobId);
    expect(stored?.status).toBe(JobStatus.PENDING);
    expect(stored?.customerId.toString()).toBeDefined();
  });

  it("rejects acceptance from a driver the job was never offered to", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("notoffered");

    const near = await registerAndApproveDriver(owner.accessToken, company.companyCode, "notofferednear");
    await makeDriverAvailableAt(near.accessToken, NEAR_DRIVER_LOCATION);

    // AVAILABLE and APPROVED, but far away — never enters offeredDriverIds.
    const far = await registerAndApproveDriver(owner.accessToken, company.companyCode, "notofferedfar");
    await makeDriverAvailableAt(far.accessToken, FAR_DRIVER_LOCATION);

    const createRes = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send(jobPayload());
    const jobId = createRes.body.data._id as string;

    const rejectedAcceptRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${far.accessToken}`);
    expect(rejectedAcceptRes.status).toBe(403);

    const acceptRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${near.accessToken}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe(JobStatus.ACCEPTED);
    expect(acceptRes.body.data.driverId).toBe(near.driverId);
  });

  it("rejects acceptance from an offered driver who is no longer AVAILABLE", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("unavailable");

    const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "unavailabledriver");
    await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

    const createRes = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send(jobPayload());
    const jobId = createRes.body.data._id as string;

    // Driver was AVAILABLE at offer time (so they're in offeredDriverIds) but goes
    // offline before actually acting on the offer.
    await setDriverStatus(driver.accessToken, DriverStatus.OFFLINE);

    const acceptRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/accept`)
      .set("Authorization", `Bearer ${driver.accessToken}`);
    expect(acceptRes.status).toBe(409);

    const stored = await JobModel.findById(jobId);
    expect(stored?.status).toBe(JobStatus.PENDING);
  });

  it("resolves a concurrent-accept race so exactly one of two simultaneous drivers wins", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("race");

    const driverA = await registerAndApproveDriver(owner.accessToken, company.companyCode, "racea");
    await makeDriverAvailableAt(driverA.accessToken, NEAR_DRIVER_LOCATION);

    const driverB = await registerAndApproveDriver(owner.accessToken, company.companyCode, "raceb");
    await makeDriverAvailableAt(driverB.accessToken, [55.2748, 25.1976]);

    const createRes = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send(jobPayload());
    const jobId = createRes.body.data._id as string;

    expect(createRes.body.data.offeredDriverIds).toEqual(
      expect.arrayContaining([driverA.driverId, driverB.driverId])
    );

    const [resA, resB] = await Promise.all([
      request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driverA.accessToken}`),
      request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driverB.accessToken}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = resA.status === 200 ? driverA : driverB;

    const stored = await JobModel.findById(jobId);
    expect(stored?.status).toBe(JobStatus.ACCEPTED);
    expect(stored?.driverId?.toString()).toBe(winner.driverId);
  });

  it("progresses status through the state machine and rejects invalid transitions, including bypassing accept via PATCH", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("statemachine");

    const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "statemachinedriver");
    await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

    const createRes = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send(jobPayload());
    const jobId = createRes.body.data._id as string;

    // ACCEPTED is not a manually-settable target — the Zod schema rejects it outright,
    // before ever reaching the state machine or driverId/vehicleId assignment logic.
    const bypassRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ status: JobStatus.ACCEPTED });
    expect(bypassRes.status).toBe(400);

    await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);

    // Skipping EN_ROUTE (ACCEPTED -> ARRIVED directly) is an invalid transition.
    const skipRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ status: JobStatus.ARRIVED });
    expect(skipRes.status).toBe(400);

    const enRouteRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ status: JobStatus.EN_ROUTE });
    expect(enRouteRes.status).toBe(200);

    const arrivedRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ status: JobStatus.ARRIVED });
    expect(arrivedRes.status).toBe(200);

    const startedRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ status: JobStatus.STARTED });
    expect(startedRes.status).toBe(200);
    expect(startedRes.body.data.startedAt).toBeDefined();

    const completedRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ status: JobStatus.COMPLETED });
    expect(completedRes.status).toBe(200);
    expect(completedRes.body.data.completedAt).toBeDefined();
    expect(completedRes.body.data.finalFare).toBe(completedRes.body.data.estimatedFare);

    // Terminal state: no further transition is valid.
    const afterCompletedRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ status: JobStatus.CANCELLED, cancellationReason: "too late" });
    expect(afterCompletedRes.status).toBe(400);

    // Completion releases the driver back to AVAILABLE.
    const driverDoc = await DriverModel.findById(driver.driverId);
    expect(driverDoc?.status).toBe(DriverStatus.AVAILABLE);

    // Full, correctly-ordered history, persisted in the repository (not just responses).
    const history = await JobStatusHistoryModel.find({ jobId }).sort({ createdAt: 1 });
    expect(history.map((h) => h.status)).toEqual([
      JobStatus.PENDING,
      JobStatus.ACCEPTED,
      JobStatus.EN_ROUTE,
      JobStatus.ARRIVED,
      JobStatus.STARTED,
      JobStatus.COMPLETED,
    ]);

    const stored = await JobModel.findById(jobId);
    expect(stored?.status).toBe(JobStatus.COMPLETED);
    expect(stored?.finalFare).toBe(stored?.estimatedFare);
  });

  it("enforces authorization and ownership on job access, status updates, and cancellation", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("authz");

    const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "authzdriver");
    await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

    // A same-company driver who is not assigned to this job.
    const bystanderDriver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "authzbystander");
    await makeDriverAvailableAt(bystanderDriver.accessToken, [55.2749, 25.1975]);

    const otherCustomer = await registerUser(UserRole.CUSTOMER, "authzothercustomer");
    const otherOwner = await registerUser(UserRole.OWNER, "authzotherowner");
    await createCompanyForOwner(otherOwner.accessToken, "authzother");

    const createRes = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send(jobPayload());
    const jobId = createRes.body.data._id as string;

    // Access checks, before any driver is assigned.
    const ownerGet = await request(app).get(`/api/v1/jobs/${jobId}`).set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerGet.status).toBe(200);

    const customerGet = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set("Authorization", `Bearer ${customer.accessToken}`);
    expect(customerGet.status).toBe(200);

    const strangerGet = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set("Authorization", `Bearer ${otherCustomer.accessToken}`);
    expect(strangerGet.status).toBe(403);

    const otherOwnerGet = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set("Authorization", `Bearer ${otherOwner.accessToken}`);
    expect(otherOwnerGet.status).toBe(403);

    await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);

    // The assigned driver can now access it too.
    const driverGet = await request(app).get(`/api/v1/jobs/${jobId}`).set("Authorization", `Bearer ${driver.accessToken}`);
    expect(driverGet.status).toBe(200);

    // A same-company driver who isn't assigned cannot progress its status.
    const bystanderStatusRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${bystanderDriver.accessToken}`)
      .send({ status: JobStatus.EN_ROUTE });
    expect(bystanderStatusRes.status).toBe(403);

    // Cancellation requires a reason.
    const missingReasonRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ status: JobStatus.CANCELLED });
    expect(missingReasonRes.status).toBe(400);

    // The customer can cancel their own job, with a reason.
    const cancelRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ status: JobStatus.CANCELLED, cancellationReason: "Changed my mind" });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe(JobStatus.CANCELLED);
    expect(cancelRes.body.data.cancellationReason).toBe("Changed my mind");

    // Cancellation also releases the driver back to AVAILABLE.
    const driverDoc = await DriverModel.findById(driver.driverId);
    expect(driverDoc?.status).toBe(DriverStatus.AVAILABLE);
  }, 45000);

  it("expires a PENDING job past its expiresAt, lazily, on read and on accept attempt", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("expiry");

    const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "expirydriver");
    await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

    // Job 1: expire it, then read it — expect the read to lazily flip it to EXPIRED.
    const createRes1 = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send(jobPayload());
    const jobId1 = createRes1.body.data._id as string;

    await JobModel.findByIdAndUpdate(jobId1, { expiresAt: new Date(Date.now() - 1000) });

    const getRes = await request(app).get(`/api/v1/jobs/${jobId1}`).set("Authorization", `Bearer ${owner.accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe(JobStatus.EXPIRED);

    const storedAfterRead = await JobModel.findById(jobId1);
    expect(storedAfterRead?.status).toBe(JobStatus.EXPIRED);

    // Job 2: expire it, then attempt to accept directly (no prior read) — accept's own
    // lazy-expiry check must catch it independently and return 410, not silently accept.
    const createRes2 = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send(jobPayload());
    const jobId2 = createRes2.body.data._id as string;

    await JobModel.findByIdAndUpdate(jobId2, { expiresAt: new Date(Date.now() - 1000) });

    const acceptRes = await request(app)
      .post(`/api/v1/jobs/${jobId2}/accept`)
      .set("Authorization", `Bearer ${driver.accessToken}`);
    expect(acceptRes.status).toBe(410);

    const storedAfterAccept = await JobModel.findById(jobId2);
    expect(storedAfterAccept?.status).toBe(JobStatus.EXPIRED);
    expect(storedAfterAccept?.driverId).toBeUndefined();
  });

  describe("socket events", () => {
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

    it("emits job:new-request to the company fleet room and job:accepted to the subscribed customer", async () => {
      const { owner, company, customer } = await createCompanyOwnerAndCustomer("socket");

      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "socketdriver");
      await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

      const driverSocket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: driver.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(driverSocket, "connect");

      const newRequestPromise = waitForSocketEvent<{ jobNumber: string; _id: string }>(driverSocket, "job:new-request");

      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      const jobId = createRes.body.data._id as string;

      const newRequestPayload = await newRequestPromise;
      expect(newRequestPayload._id).toBe(jobId);

      const customerSocket: ClientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: customer.accessToken },
        transports: ["websocket"],
      });
      await waitForSocketEvent(customerSocket, "connect");

      const subscribedPromise = waitForSocketEvent(customerSocket, "job:subscribed");
      customerSocket.emit("job:subscribe", jobId);
      await subscribedPromise;

      const acceptedPromise = waitForSocketEvent<{ _id: string; status: string }>(customerSocket, "job:accepted");

      const acceptRes = await request(app)
        .post(`/api/v1/jobs/${jobId}/accept`)
        .set("Authorization", `Bearer ${driver.accessToken}`);
      expect(acceptRes.status).toBe(200);

      const acceptedPayload = await acceptedPromise;
      expect(acceptedPayload._id).toBe(jobId);
      expect(acceptedPayload.status).toBe(JobStatus.ACCEPTED);

      driverSocket.disconnect();
      customerSocket.disconnect();
    });
  });

  // Gap #13 (GAP-REPORT.md) — the Customer active-job/tracking view's "who's my
  // driver" display.
  describe("assignedDriver on GET /jobs/:id (Gap #13)", () => {
    it("is absent before a driver is assigned, then exposes exactly name/photo/rating (never email/phone) to the job's own customer, and never to a different customer", async () => {
      const { owner, company, customer } = await createCompanyOwnerAndCustomer("gap13");
      const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "gap13driver");
      await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

      // Give the driver a photo + a non-zero rating so the test can assert real
      // values, not just "the key happens to be absent/zero by default."
      await request(app)
        .patch(`/api/v1/drivers/${driver.driverId}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ profileImage: "https://example.com/driver-photo.jpg" });
      await DriverModel.findByIdAndUpdate(driver.driverId, { rating: 4.8 });

      const otherCustomer = await registerUser(UserRole.CUSTOMER, "gap13othercustomer");

      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      const jobId = createRes.body.data._id as string;

      // Before acceptance: no driver assigned yet, so nothing to show.
      const beforeAccept = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set("Authorization", `Bearer ${customer.accessToken}`);
      expect(beforeAccept.status).toBe(200);
      expect(beforeAccept.body.data.assignedDriver).toBeNull();

      await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);

      // The job's own customer sees exactly the public identity fields.
      const ownCustomerGet = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set("Authorization", `Bearer ${customer.accessToken}`);
      expect(ownCustomerGet.status).toBe(200);
      expect(ownCustomerGet.body.data.assignedDriver).toEqual({
        firstName: "Test",
        lastName: "gap13driver",
        profileImage: "https://example.com/driver-photo.jpg",
        rating: 4.8,
      });
      expect(ownCustomerGet.body.data.assignedDriver.email).toBeUndefined();
      expect(ownCustomerGet.body.data.assignedDriver.phone).toBeUndefined();

      // A different customer cannot reach this job at all (403, before the
      // assignedDriver field even matters) — the actual boundary Gap #13 cares
      // about: identity for the assigned driver leaks to no one but this job's
      // own customer.
      const strangerGet = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set("Authorization", `Bearer ${otherCustomer.accessToken}`);
      expect(strangerGet.status).toBe(403);
      expect(strangerGet.body.data).toBeUndefined();

      // The assigned driver and the owning OWNER can also see it (both already had
      // full job access before this gap; assignedDriver adds nothing new for them).
      const driverGet = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set("Authorization", `Bearer ${driver.accessToken}`);
      expect(driverGet.body.data.assignedDriver.firstName).toBe("Test");

      const ownerGet = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set("Authorization", `Bearer ${owner.accessToken}`);
      expect(ownerGet.body.data.assignedDriver.firstName).toBe("Test");
    }, 45000);
  });
});
