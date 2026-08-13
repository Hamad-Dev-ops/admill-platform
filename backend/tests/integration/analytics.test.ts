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
  // "1" + "0" prefix ("10...") distinguishes this file's phone numbers from other
  // test files sharing the same real Atlas cluster.
  return `10${runId}${phoneSeq}`;
}

const JOB_SERVICE_TYPE = ServiceType.BIKE_TOWING;
const PICKUP = { type: "Point" as const, coordinates: [55.2744, 25.1972] as [number, number] };
const DESTINATION = { type: "Point" as const, coordinates: [55.14, 25.08] as [number, number] };
const NEAR_DRIVER_LOCATION: [number, number] = [55.275, 25.198];

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m10-${tag}-${runId}@admill.test`,
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
// company server-side via DEFAULT_COMPANY_CODE; callers must point that env
// var at the right company themselves (see createCompletedJob/
// createCompanyJobWithExistingDriver below) since this file specifically
// tests multi-company isolation (companyA/companyB) and can't rely on
// "whichever company was created most recently."
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
  await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${customer.accessToken}`)
    .send({ nationalId: `NID-CUS-${runId}-${tag}` });

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
  return res.body.data;
}

// Drives a job to COMPLETED and returns its actual server-computed finalFare — used as
// the "known input" for hand-verifying the analytics aggregation math (the pricing
// engine's own correctness is already covered by Milestone 5's tests; this only needs
// a real, known fare value to sum/average by hand).
async function createCompletedJob(tag: string, companyId: string, ownerToken: string, driverTag: string) {
  const companyCode = (await CompanyModel.findById(companyId))!.companyCode;
  const driver = await registerAndApproveDriver(ownerToken, companyCode, driverTag);
  await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

  const customer = await registerUser(UserRole.CUSTOMER, `${tag}customer`);
  await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${customer.accessToken}`)
    .send({ nationalId: `NID-CUS-${runId}-${tag}` });

  const restore = withDefaultCompany(companyCode);
  const jobId = await (async () => {
    try {
      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      return createRes.body.data._id as string;
    } finally {
      restore();
    }
  })();

  await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);
  await progressStatus(driver.accessToken, jobId, JobStatus.EN_ROUTE);
  await progressStatus(driver.accessToken, jobId, JobStatus.ARRIVED);
  await progressStatus(driver.accessToken, jobId, JobStatus.STARTED);
  const completed = await progressStatus(driver.accessToken, jobId, JobStatus.COMPLETED);

  return { driver, customer, jobId, finalFare: completed.finalFare as number };
}

// Dispatches a second job to a driver already registered/approved for `companyCtx`,
// reusing the existing driver instead of creating a new one — needed to test the
// "same driver, multiple completed jobs" aggregation case.
async function createCompanyJobWithExistingDriver(
  companyCtx: { owner: { accessToken: string }; company: { _id: string; companyCode: string } },
  driver: { accessToken: string; driverId: string },
  tag: string
) {
  const customer = await registerUser(UserRole.CUSTOMER, `${tag}customer`);
  await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${customer.accessToken}`)
    .send({ nationalId: `NID-CUS-${runId}-${tag}` });

  const restore = withDefaultCompany(companyCtx.company.companyCode);
  const jobId = await (async () => {
    try {
      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send(jobPayload());
      return createRes.body.data._id as string;
    } finally {
      restore();
    }
  })();

  await request(app).post(`/api/v1/jobs/${jobId}/accept`).set("Authorization", `Bearer ${driver.accessToken}`);
  await progressStatus(driver.accessToken, jobId, JobStatus.EN_ROUTE);
  await progressStatus(driver.accessToken, jobId, JobStatus.ARRIVED);
  await progressStatus(driver.accessToken, jobId, JobStatus.STARTED);
  const completed = await progressStatus(driver.accessToken, jobId, JobStatus.COMPLETED);

  return { jobId, finalFare: completed.finalFare as number };
}

describe("Analytics & Reporting (Milestone 10)", () => {
  let preExistingServiceIds: string[] = [];

  beforeAll(async () => {
    await connectTestDb();
    preExistingServiceIds = (await ServiceModel.find().select("_id")).map((s) => s._id.toString());
  });

  afterAll(async () => {
    const testUsers = await UserModel.find({ email: /^m10-.*@admill\.test$/ }).select("_id");
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

  it("rejects non-OWNER roles on all three analytics endpoints", async () => {
    const { customer } = await createCompanyOwnerAndCustomer("authz");
    const driver = await registerUser(UserRole.DRIVER, "authzdriver");

    for (const token of [customer.accessToken, driver.accessToken]) {
      const revenueRes = await request(app).get("/api/v1/analytics/revenue").set("Authorization", `Bearer ${token}`);
      expect(revenueRes.status).toBe(403);

      const driversRes = await request(app).get("/api/v1/analytics/drivers").set("Authorization", `Bearer ${token}`);
      expect(driversRes.status).toBe(403);

      const fleetRes = await request(app)
        .get("/api/v1/analytics/fleet-utilization")
        .set("Authorization", `Bearer ${token}`);
      expect(fleetRes.status).toBe(403);
    }
  }, 30000);

  it(
    "scopes revenue, driver, and fleet reports strictly to the requesting company, matching hand-tallied totals from real completed jobs",
    async () => {
      const companyA = await createCompanyOwnerAndCustomer("isoA");
      const companyB = await createCompanyOwnerAndCustomer("isoB");

      const jobA1 = await createCompletedJob("isoA1", companyA.company._id, companyA.owner.accessToken, "isoAdriver");
      await makeDriverAvailableAt(jobA1.driver.accessToken, NEAR_DRIVER_LOCATION);
      const jobA2 = await createCompanyJobWithExistingDriver(companyA, jobA1.driver, "isoA2");

      const jobB1 = await createCompletedJob("isoB1", companyB.company._id, companyB.owner.accessToken, "isoBdriver");

      const expectedRevenueA = jobA1.finalFare + jobA2.finalFare;

      const revenueResA = await request(app)
        .get("/api/v1/analytics/revenue")
        .set("Authorization", `Bearer ${companyA.owner.accessToken}`);
      expect(revenueResA.status).toBe(200);
      expect(revenueResA.body.data.completedJobsCount).toBe(2);
      expect(revenueResA.body.data.totalRevenue).toBeCloseTo(expectedRevenueA, 2);

      const revenueResB = await request(app)
        .get("/api/v1/analytics/revenue")
        .set("Authorization", `Bearer ${companyB.owner.accessToken}`);
      expect(revenueResB.status).toBe(200);
      expect(revenueResB.body.data.completedJobsCount).toBe(1);
      expect(revenueResB.body.data.totalRevenue).toBeCloseTo(jobB1.finalFare, 2);

      // Driver roster: company A's report includes only A's driver, with the correct
      // aggregated completedJobsCount/revenue from both of A's jobs (same driver).
      const driversResA = await request(app)
        .get("/api/v1/analytics/drivers")
        .set("Authorization", `Bearer ${companyA.owner.accessToken}`);
      expect(driversResA.status).toBe(200);
      expect(driversResA.body.data).toHaveLength(1);
      expect(driversResA.body.data[0].driverId).toBe(jobA1.driver.driverId);
      expect(driversResA.body.data[0].completedJobsCount).toBe(2);
      expect(driversResA.body.data[0].revenue).toBeCloseTo(expectedRevenueA, 2);
      expect(driversResA.body.data.some((d: { driverId: string }) => d.driverId === jobB1.driver.driverId)).toBe(false);

      // Fleet: neither company assigned a vehicle (none created), so completedJobsCount
      // per vehicle is moot here — verify the roster itself is correctly isolated
      // (0 vehicles either side, no cross-contamination possible or observed).
      const fleetResA = await request(app)
        .get("/api/v1/analytics/fleet-utilization")
        .set("Authorization", `Bearer ${companyA.owner.accessToken}`);
      expect(fleetResA.status).toBe(200);
      expect(fleetResA.body.data.totalVehicles).toBe(0);
      expect(fleetResA.body.data.vehicles).toEqual([]);
      // Two full company/owner/customer setups (9 real user registrations, each real
      // bcrypt work) plus 3 full job-completion flows against real Atlas is genuinely
      // the heaviest single test in this suite — the same "accumulated real work"
      // headroom class M9's 3-job aggregate test needed 60s for, scaled up further by
      // the second company this test's own isolation guarantee requires.
    },
    100000
  );

  it("filters by date range inclusively at both boundaries", async () => {
    const { owner, company } = await createCompanyOwnerAndCustomer("daterange");
    const job = await createCompletedJob("daterange1", company._id, owner.accessToken, "daterangedriver");

    // Pin completedAt to an exact, known instant — the same "reach into internal state
    // to control time deterministically" technique job.test.ts already established for
    // Job.expiresAt, rather than depending on real wall-clock timing.
    const pinned = new Date("2026-03-15T12:00:00.000Z");
    await JobModel.findByIdAndUpdate(job.jobId, { completedAt: pinned });

    const exactBoundary = await request(app)
      .get(`/api/v1/analytics/revenue?startDate=${pinned.toISOString()}&endDate=${pinned.toISOString()}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(exactBoundary.body.data.completedJobsCount).toBe(1);

    const beforeRange = await request(app)
      .get(
        `/api/v1/analytics/revenue?startDate=2026-01-01T00:00:00.000Z&endDate=${new Date(
          pinned.getTime() - 1
        ).toISOString()}`
      )
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(beforeRange.body.data.completedJobsCount).toBe(0);
    expect(beforeRange.body.data.totalRevenue).toBe(0);

    const afterRange = await request(app)
      .get(`/api/v1/analytics/revenue?startDate=${new Date(pinned.getTime() + 1).toISOString()}&endDate=2026-12-31T00:00:00.000Z`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(afterRange.body.data.completedJobsCount).toBe(0);

    const spanningRange = await request(app)
      .get("/api/v1/analytics/revenue?startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T00:00:00.000Z")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(spanningRange.body.data.completedJobsCount).toBe(1);
    expect(spanningRange.body.data.totalRevenue).toBeCloseTo(job.finalFare, 2);
  }, 30000);

  it("rejects invalid date query values", async () => {
    const { owner } = await createCompanyOwnerAndCustomer("baddate");

    const res = await request(app)
      .get("/api/v1/analytics/revenue?startDate=not-a-date")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(400);
  });

});
