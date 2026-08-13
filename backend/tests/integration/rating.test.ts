import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { DriverStatus } from "../../src/constants/driver.enum";
import { JobStatus } from "../../src/constants/job.enum";
import { UserRole } from "../../src/constants/role.enum";
import { ServiceType } from "../../src/constants/service.enum";
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { CustomerModel } from "../../src/models/customer.model";
import { DriverModel } from "../../src/models/driver.model";
import { FareCalculationModel } from "../../src/models/fareCalculation.model";
import { JobModel } from "../../src/models/job.model";
import { JobStatusHistoryModel } from "../../src/models/jobStatusHistory.model";
import { NotificationModel } from "../../src/models/notification.model";
import { RatingModel } from "../../src/models/rating.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { ServiceModel } from "../../src/models/service.model";
import { UserModel } from "../../src/models/user.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";
import { withDefaultCompany } from "../setup/defaultCompany";

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "9" prefix distinguishes this file's phone numbers from other test files sharing
  // the same real Atlas cluster.
  return `9${runId}${phoneSeq}`;
}

const JOB_SERVICE_TYPE = ServiceType.BIKE_TOWING;
const PICKUP = { type: "Point" as const, coordinates: [55.2744, 25.1972] as [number, number] };
const DESTINATION = { type: "Point" as const, coordinates: [55.14, 25.08] as [number, number] };
const NEAR_DRIVER_LOCATION: [number, number] = [55.275, 25.198];

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m9-${tag}-${runId}@admill.test`,
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
// company server-side via DEFAULT_COMPANY_CODE; each call site below wraps
// its own request with withDefaultCompany(company.companyCode) since this
// file (unlike job.test.ts) mixes a shared helper with a couple of direct
// call sites, and one test reuses an earlier test's company explicitly.
function jobPayload() {
  return {
    serviceType: JOB_SERVICE_TYPE,
    pickupLocation: { geo: PICKUP, address: "Burj Khalifa, Dubai" },
    destinationLocation: { geo: DESTINATION, address: "Dubai Marina, Dubai" },
  };
}

async function registerCustomer(tag: string) {
  const customer = await registerUser(UserRole.CUSTOMER, tag);
  await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${customer.accessToken}`)
    .send({ nationalId: `NID-CUS-${runId}-${tag}` });
  return customer;
}

async function createCompanyOwnerAndCustomer(tag: string) {
  const owner = await registerUser(UserRole.OWNER, `${tag}owner`);
  const company = await createCompanyForOwner(owner.accessToken, tag);
  const customer = await registerCustomer(`${tag}customer`);

  await ensureServiceCatalogEntry(owner.accessToken);
  return { owner, company, customer };
}

async function progressStatus(driverToken: string, jobId: string, status: JobStatus) {
  const res = await request(app)
    .patch(`/api/v1/jobs/${jobId}/status`)
    .set("Authorization", `Bearer ${driverToken}`)
    .send({ status });
  if (res.status !== 200) {
    throw new Error(`Failed to progress job ${jobId} to ${status}: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

// Drives a job all the way to COMPLETED — the only state a rating can ever be
// submitted against (Milestone 9's own acceptance criterion).
async function createCompletedJob(tag: string, driverTag = `${tag}driver`) {
  const { owner, company, customer } = await createCompanyOwnerAndCustomer(tag);
  const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, driverTag);
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
  await progressStatus(driver.accessToken, jobId, JobStatus.EN_ROUTE);
  await progressStatus(driver.accessToken, jobId, JobStatus.ARRIVED);
  await progressStatus(driver.accessToken, jobId, JobStatus.STARTED);
  await progressStatus(driver.accessToken, jobId, JobStatus.COMPLETED);

  // Driver goes back AVAILABLE on completion (M6) — re-mark available so a shared
  // driver can be reused across multiple completed jobs in the aggregate test below.
  await setDriverStatus(driver.accessToken, DriverStatus.AVAILABLE);

  return { owner, company, customer, driver, jobId };
}

describe("Ratings & Job Completion (Milestone 9)", () => {
  let preExistingServiceIds: string[] = [];

  beforeAll(async () => {
    await connectTestDb();
    preExistingServiceIds = (await ServiceModel.find().select("_id")).map((s) => s._id.toString());
  });

  afterAll(async () => {
    const testUsers = await UserModel.find({ email: /^m9-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    const testDrivers = await DriverModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testDriverIds = testDrivers.map((d) => d._id);

    const testCustomers = await CustomerModel.find({ userId: { $in: testUserIds } }).select("_id");
    const testCustomerIds = testCustomers.map((c) => c._id);

    const testJobs = await JobModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testJobIds = testJobs.map((j) => j._id);

    await RatingModel.deleteMany({ driverId: { $in: testDriverIds } });
    await NotificationModel.deleteMany({ receiverId: { $in: testUserIds } });
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

  it("rejects rating a job that isn't COMPLETED yet", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("notcompleted");
    const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "notcompleteddriver");
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

    // Still PENDING.
    const pendingRateRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/rating`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ stars: 5 });
    expect(pendingRateRes.status).toBe(409);

    await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);

    // ACCEPTED, still not COMPLETED.
    const acceptedRateRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/rating`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ stars: 5 });
    expect(acceptedRateRes.status).toBe(409);

    expect(await RatingModel.countDocuments({ jobId })).toBe(0);
  }, 30000);

  it("allows only that job's own customer to rate it — the driver and a stranger customer are both rejected", async () => {
    const { customer, driver, jobId } = await createCompletedJob("ownership");

    const strangerCustomer = await registerUser(UserRole.CUSTOMER, "ownershipstranger");
    const strangerRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/rating`)
      .set("Authorization", `Bearer ${strangerCustomer.accessToken}`)
      .send({ stars: 4 });
    expect(strangerRes.status).toBe(403);

    // The driver role is rejected at the route (CUSTOMER-only), before it ever
    // reaches RatingService's own ownership check.
    const driverRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/rating`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ stars: 4 });
    expect(driverRes.status).toBe(403);

    const ownRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/rating`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ stars: 4, review: "Great service" });
    expect(ownRes.status).toBe(201);
    expect(ownRes.body.data.stars).toBe(4);
    expect(ownRes.body.data.review).toBe("Great service");
  }, 30000);

  it("rejects a second rating attempt on the same job", async () => {
    const { customer, jobId } = await createCompletedJob("onlyonce");

    const firstRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/rating`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ stars: 5 });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/rating`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ stars: 1 });
    expect(secondRes.status).toBe(409);

    const stored = await RatingModel.find({ jobId });
    expect(stored).toHaveLength(1);
    expect(stored[0].stars).toBe(5);
  }, 30000);

  it("recomputes the driver's rating/totalTrips correctly across 3+ ratings, matching hand-calculated averages", async () => {
    // Same driver rated across three separately-completed jobs.
    const first = await createCompletedJob("aggregate1", "aggregatedriver");
    const driverToken = first.driver.accessToken;
    const driverId = first.driver.driverId;

    // Dispatches a second/third job to the exact same driver+company as `first`,
    // rather than creating an unrelated company/owner per job.
    async function completeAnotherJobWithSameDriver(tag: string) {
      const customer = await registerCustomer(tag);

      const restoreDefaultCompany = withDefaultCompany(first.company.companyCode);
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

      await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driverToken}`);
      await progressStatus(driverToken, jobId, JobStatus.EN_ROUTE);
      await progressStatus(driverToken, jobId, JobStatus.ARRIVED);
      await progressStatus(driverToken, jobId, JobStatus.STARTED);
      await progressStatus(driverToken, jobId, JobStatus.COMPLETED);
      await setDriverStatus(driverToken, DriverStatus.AVAILABLE);

      return { customer, jobId };
    }

    await makeDriverAvailableAt(driverToken, NEAR_DRIVER_LOCATION);
    const second = await completeAnotherJobWithSameDriver("aggregate2");
    await makeDriverAvailableAt(driverToken, NEAR_DRIVER_LOCATION);
    const third = await completeAnotherJobWithSameDriver("aggregate3");

    // Three ratings: 5, 3, 4 -> average 4.0, totalTrips 3 (hand-calculated).
    await request(app)
      .post(`/api/v1/jobs/${first.jobId}/rating`)
      .set("Authorization", `Bearer ${first.customer.accessToken}`)
      .send({ stars: 5 });
    await request(app)
      .post(`/api/v1/jobs/${second.jobId}/rating`)
      .set("Authorization", `Bearer ${second.customer.accessToken}`)
      .send({ stars: 3 });
    const thirdRes = await request(app)
      .post(`/api/v1/jobs/${third.jobId}/rating`)
      .set("Authorization", `Bearer ${third.customer.accessToken}`)
      .send({ stars: 4 });
    expect(thirdRes.status).toBe(201);

    const driverDoc = await DriverModel.findById(driverId);
    expect(driverDoc?.rating).toBeCloseTo(4.0, 5);
    expect(driverDoc?.totalTrips).toBe(3);
    // Three full job-completion flows (registration + accept + 4 status transitions
    // each) plus 3 ratings is genuinely more sequential real work than any single
    // existing test in this suite — the same "accumulated real work" headroom class
    // as job.test.ts's/tracking.test.ts's heaviest tests, just heavier still. Bumped
    // from 60s to 90s: this environment now also runs a live ngrok tunnel to the same
    // backend/Atlas cluster for real concurrent device testing, adding genuine
    // real-world contention on top of an already-tight budget — not a logic change.
  }, 90000);

  it("GET /drivers/:id/ratings lists a driver's ratings (self/owner allowed, an unrelated customer rejected)", async () => {
    const { owner, driver, jobId, customer } = await createCompletedJob("listratings");

    await request(app)
      .post(`/api/v1/jobs/${jobId}/rating`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ stars: 5, review: "Excellent" });

    const selfRes = await request(app)
      .get(`/api/v1/drivers/${driver.driverId}/ratings`)
      .set("Authorization", `Bearer ${driver.accessToken}`);
    expect(selfRes.status).toBe(200);
    expect(selfRes.body.data).toHaveLength(1);
    expect(selfRes.body.data[0].stars).toBe(5);
    expect(selfRes.body.meta.total).toBe(1);

    const ownerRes = await request(app)
      .get(`/api/v1/drivers/${driver.driverId}/ratings`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerRes.status).toBe(200);

    // Reusing the existing driver-access authorization (DriverService.getRawById) —
    // a customer role is never granted access by that check, even the one who rated.
    const customerRes = await request(app)
      .get(`/api/v1/drivers/${driver.driverId}/ratings`)
      .set("Authorization", `Bearer ${customer.accessToken}`);
    expect(customerRes.status).toBe(403);
  }, 30000);
});
