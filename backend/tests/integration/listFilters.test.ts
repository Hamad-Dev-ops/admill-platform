import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { DriverApprovalStatus, DriverStatus } from "../../src/constants/driver.enum";
import { JobStatus } from "../../src/constants/job.enum";
import { UserRole } from "../../src/constants/role.enum";
import { ServiceType } from "../../src/constants/service.enum";
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { CustomerModel } from "../../src/models/customer.model";
import { DriverModel } from "../../src/models/driver.model";
import { JobModel } from "../../src/models/job.model";
import { NotificationModel } from "../../src/models/notification.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { ServiceModel } from "../../src/models/service.model";
import { UserModel } from "../../src/models/user.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";
import { withDefaultCompany } from "../setup/defaultCompany";

// Regression coverage for the list-filter bug found during Gap #14 operational
// verification: GET /jobs, GET /drivers and GET /notifications each build their
// Mongo query as `{ ...requiredScope, ...optionalFilter }`. When the optional filter
// (status/approvalStatus/isRead) is omitted, its value is `undefined`, and spreading
// `{ someKey: undefined }` into the query made Mongo match against the deprecated BSON
// "Undefined" type — matching nothing, ever. Fixed via src/utils/object.ts's
// omitUndefined(), applied in job.repository.ts, driver.repository.ts and
// notification.repository.ts. See GAP-REPORT.md for the full write-up.
//
// No existing test anywhere in this suite called GET /jobs or GET /drivers with no
// query params at all before this file — that's exactly why the bug went unnoticed.

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "15" prefix distinguishes this file's phone numbers from other test files
  // sharing the same real Atlas cluster.
  return `15${runId}${phoneSeq}`;
}

const JOB_SERVICE_TYPE = ServiceType.BIKE_TOWING;
const PICKUP = { type: "Point" as const, coordinates: [55.2744, 25.1972] as [number, number] };
const DESTINATION = { type: "Point" as const, coordinates: [55.14, 25.08] as [number, number] };
const NEAR_DRIVER_LOCATION: [number, number] = [55.275, 25.198];

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `lf-${tag}-${runId}@admill.test`,
    phone: uniquePhone(),
    password: "Password123!",
    role,
  };

  const res = await request(app).post("/api/v1/auth/register").send(payload);

  return {
    userId: res.body.data.user.id as string,
    accessToken: res.body.data.accessToken as string,
  };
}

async function createCompanyForOwner(accessToken: string, tag: string) {
  const res = await request(app)
    .post("/api/v1/companies")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      companyName: `Test Recovery Co ${tag}`,
      email: `lf-company-${tag}-${runId}@admill.test`,
      phone: uniquePhone(),
      address: "123 Sheikh Zayed Rd",
      city: "Dubai",
      country: "UAE",
      tradeLicenseNumber: `TL-LF-${runId}-${tag}`,
      tradeLicenseExpiry: "2030-01-01",
      serviceAreas: ["Dubai"],
    });

  return res.body.data as { companyCode: string; _id: string };
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

async function registerDriver(driverToken: string, companyCode: string, tag: string) {
  const res = await request(app)
    .post("/api/v1/drivers")
    .set("Authorization", `Bearer ${driverToken}`)
    .send({
      companyCode,
      nationalId: `NID-LF-${runId}-${tag}`,
      emiratesId: `784-LF-${runId}-${tag}`,
      emiratesIdExpiry: "2030-01-01",
      drivingLicenseNumber: `DL-LF-${runId}-${tag}`,
      drivingLicenseExpiry: "2030-01-01",
    });

  return res.body.data._id as string;
}

function jobPayload() {
  return {
    serviceType: JOB_SERVICE_TYPE,
    pickupLocation: { geo: PICKUP, address: "Burj Khalifa, Dubai" },
    destinationLocation: { geo: DESTINATION, address: "Dubai Marina, Dubai" },
  };
}

async function createJobAs(customerToken: string, companyCode: string) {
  const restore = withDefaultCompany(companyCode);
  try {
    return await request(app).post("/api/v1/jobs").set("Authorization", `Bearer ${customerToken}`).send(jobPayload());
  } finally {
    restore();
  }
}

describe("List endpoints ignore an omitted optional filter instead of matching nothing", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    const testUsers = await UserModel.find({ email: /^lf-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    const testDrivers = await DriverModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testDriverIds = testDrivers.map((d) => d._id);

    const testCustomers = await CustomerModel.find({ userId: { $in: testUserIds } }).select("_id");
    const testCustomerIds = testCustomers.map((c) => c._id);

    const testJobs = await JobModel.find({ companyId: { $in: testCompanyIds } }).select("_id");

    await NotificationModel.deleteMany({ receiverId: { $in: testUserIds } });
    await JobModel.deleteMany({ _id: { $in: testJobs.map((j) => j._id) } });
    await CustomerModel.deleteMany({ _id: { $in: testCustomerIds } });
    await DriverModel.deleteMany({ _id: { $in: testDriverIds } });
    await CompanySettingsModel.deleteMany({ companyId: { $in: testCompanyIds } });
    await CompanyModel.deleteMany({ _id: { $in: testCompanyIds } });
    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });

    await disconnectTestDb();
  });

  describe("GET /jobs", () => {
    it("with no ?status returns every job the role can see, filters correctly when ?status is given, and never leaks another company's jobs", async () => {
      const ownerA = await registerUser(UserRole.OWNER, "jobsownera");
      const companyA = await createCompanyForOwner(ownerA.accessToken, "jobsa");
      await ensureServiceCatalogEntry(ownerA.accessToken);
      const customerA = await registerUser(UserRole.CUSTOMER, "jobscustomera");
      await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${customerA.accessToken}`)
        .send({ nationalId: `NID-LF-CUS-${runId}-jobsa` });

      // A second, unrelated company — proves the fix didn't turn "no filter" into
      // "no scoping at all"; companyId is a required positional arg, never part of
      // the optional filter object, and must still narrow results.
      const ownerB = await registerUser(UserRole.OWNER, "jobsownerb");
      const companyB = await createCompanyForOwner(ownerB.accessToken, "jobsb");
      await ensureServiceCatalogEntry(ownerB.accessToken);
      const customerB = await registerUser(UserRole.CUSTOMER, "jobscustomerb");
      await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${customerB.accessToken}`)
        .send({ nationalId: `NID-LF-CUS-${runId}-jobsb` });
      const otherCompanyJob = await createJobAs(customerB.accessToken, companyB.companyCode);
      expect(otherCompanyJob.status).toBe(201);

      // Two jobs under company A, in two different statuses.
      const pendingJob = await createJobAs(customerA.accessToken, companyA.companyCode);
      expect(pendingJob.status).toBe(201);
      const jobToCancel = await createJobAs(customerA.accessToken, companyA.companyCode);
      expect(jobToCancel.status).toBe(201);
      const cancelRes = await request(app)
        .patch(`/api/v1/jobs/${jobToCancel.body.data._id}/status`)
        .set("Authorization", `Bearer ${customerA.accessToken}`)
        .send({ status: JobStatus.CANCELLED, cancellationReason: "no longer needed" });
      expect(cancelRes.status).toBe(200);

      // No ?status — both of company A's jobs come back, meta.total matches, and
      // company B's job is absent.
      const unfiltered = await request(app).get("/api/v1/jobs").set("Authorization", `Bearer ${ownerA.accessToken}`);
      expect(unfiltered.status).toBe(200);
      expect(unfiltered.body.meta.total).toBe(2);
      const unfilteredIds = unfiltered.body.data.map((j: { _id: string }) => j._id);
      expect(unfilteredIds).toEqual(expect.arrayContaining([pendingJob.body.data._id, jobToCancel.body.data._id]));
      expect(unfilteredIds).not.toContain(otherCompanyJob.body.data._id);

      // ?status=PENDING still filters correctly.
      const pendingOnly = await request(app)
        .get("/api/v1/jobs?status=PENDING")
        .set("Authorization", `Bearer ${ownerA.accessToken}`);
      expect(pendingOnly.status).toBe(200);
      expect(pendingOnly.body.meta.total).toBe(1);
      expect(pendingOnly.body.data[0]._id).toBe(pendingJob.body.data._id);

      // ?status=CANCELLED still filters correctly.
      const cancelledOnly = await request(app)
        .get("/api/v1/jobs?status=CANCELLED")
        .set("Authorization", `Bearer ${ownerA.accessToken}`);
      expect(cancelledOnly.status).toBe(200);
      expect(cancelledOnly.body.meta.total).toBe(1);
      expect(cancelledOnly.body.data[0]._id).toBe(jobToCancel.body.data._id);

      // Role scoping unchanged: the customer's own unfiltered list only ever shows
      // their own jobs, never another customer's, even within the same company.
      const customerUnfiltered = await request(app)
        .get("/api/v1/jobs")
        .set("Authorization", `Bearer ${customerA.accessToken}`);
      expect(customerUnfiltered.status).toBe(200);
      expect(customerUnfiltered.body.meta.total).toBe(2);
    }, 30000);
  });

  describe("GET /drivers", () => {
    it("with no ?approvalStatus returns every driver in the owner's company, filters correctly when ?approvalStatus is given, and never leaks another company's drivers, and stays OWNER-only", async () => {
      const ownerA = await registerUser(UserRole.OWNER, "driversownera");
      const companyA = await createCompanyForOwner(ownerA.accessToken, "driversa");

      const ownerB = await registerUser(UserRole.OWNER, "driversownerb");
      const companyB = await createCompanyForOwner(ownerB.accessToken, "driversb");
      const otherCompanyDriverUser = await registerUser(UserRole.DRIVER, "driversotherdriver");
      const otherCompanyDriverId = await registerDriver(otherCompanyDriverUser.accessToken, companyB.companyCode, "driversother");
      expect(otherCompanyDriverId).toBeTruthy();

      // One approved driver, one left at the default PENDING_APPROVAL state.
      const approvedDriverUser = await registerUser(UserRole.DRIVER, "driversapproved");
      const approvedDriverId = await registerDriver(approvedDriverUser.accessToken, companyA.companyCode, "driversapproved");
      const approveRes = await request(app)
        .patch(`/api/v1/drivers/${approvedDriverId}/approve`)
        .set("Authorization", `Bearer ${ownerA.accessToken}`);
      expect(approveRes.status).toBe(200);

      const pendingDriverUser = await registerUser(UserRole.DRIVER, "driverspending");
      const pendingDriverId = await registerDriver(pendingDriverUser.accessToken, companyA.companyCode, "driverspending");

      // No ?approvalStatus — both of company A's drivers come back, meta.total
      // matches, and company B's driver is absent.
      const unfiltered = await request(app).get("/api/v1/drivers").set("Authorization", `Bearer ${ownerA.accessToken}`);
      expect(unfiltered.status).toBe(200);
      expect(unfiltered.body.meta.total).toBe(2);
      const unfilteredIds = unfiltered.body.data.map((d: { _id: string }) => d._id);
      expect(unfilteredIds).toEqual(expect.arrayContaining([approvedDriverId, pendingDriverId]));
      expect(unfilteredIds).not.toContain(otherCompanyDriverId);

      // ?approvalStatus=APPROVED still filters correctly.
      const approvedOnly = await request(app)
        .get(`/api/v1/drivers?approvalStatus=${DriverApprovalStatus.APPROVED}`)
        .set("Authorization", `Bearer ${ownerA.accessToken}`);
      expect(approvedOnly.status).toBe(200);
      expect(approvedOnly.body.meta.total).toBe(1);
      expect(approvedOnly.body.data[0]._id).toBe(approvedDriverId);

      // ?approvalStatus=PENDING_APPROVAL still filters correctly.
      const pendingOnly = await request(app)
        .get(`/api/v1/drivers?approvalStatus=${DriverApprovalStatus.PENDING_APPROVAL}`)
        .set("Authorization", `Bearer ${ownerA.accessToken}`);
      expect(pendingOnly.status).toBe(200);
      expect(pendingOnly.body.meta.total).toBe(1);
      expect(pendingOnly.body.data[0]._id).toBe(pendingDriverId);

      // RBAC unchanged — a DRIVER still cannot list a company's roster.
      const asDriver = await request(app).get("/api/v1/drivers").set("Authorization", `Bearer ${approvedDriverUser.accessToken}`);
      expect(asDriver.status).toBe(403);
    });
  });

  describe("GET /notifications", () => {
    it("with no ?isRead returns every notification for the caller, filters correctly when ?isRead is given, and stays self-only", async () => {
      const ownerA = await registerUser(UserRole.OWNER, "notifsownera");
      const companyA = await createCompanyForOwner(ownerA.accessToken, "notifsa");
      await ensureServiceCatalogEntry(ownerA.accessToken);
      const customerA = await registerUser(UserRole.CUSTOMER, "notifscustomera");
      await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${customerA.accessToken}`)
        .send({ nationalId: `NID-LF-CUS-${runId}-notifsa` });

      const driverUser = await registerUser(UserRole.DRIVER, "notifsdriver");
      const driverId = await registerDriver(driverUser.accessToken, companyA.companyCode, "notifsdriver");
      await request(app)
        .patch(`/api/v1/drivers/${driverId}/approve`)
        .set("Authorization", `Bearer ${ownerA.accessToken}`);
      await request(app)
        .patch("/api/v1/drivers/me/location")
        .set("Authorization", `Bearer ${driverUser.accessToken}`)
        .send({ location: { type: "Point", coordinates: NEAR_DRIVER_LOCATION } });
      await request(app)
        .patch("/api/v1/drivers/me/status")
        .set("Authorization", `Bearer ${driverUser.accessToken}`)
        .send({ status: DriverStatus.AVAILABLE });

      // Two JOB_REQUEST notifications land on the driver (one per job created while
      // AVAILABLE) — mark one read so the file has one read + one unread to filter.
      const job1 = await createJobAs(customerA.accessToken, companyA.companyCode);
      expect(job1.status).toBe(201);
      const job2 = await createJobAs(customerA.accessToken, companyA.companyCode);
      expect(job2.status).toBe(201);

      const unreadBefore = await request(app)
        .get("/api/v1/notifications?isRead=false")
        .set("Authorization", `Bearer ${driverUser.accessToken}`);
      expect(unreadBefore.body.meta.total).toBe(2);
      const notificationToMarkRead = unreadBefore.body.data[0]._id as string;
      const markReadRes = await request(app)
        .patch(`/api/v1/notifications/${notificationToMarkRead}/read`)
        .set("Authorization", `Bearer ${driverUser.accessToken}`);
      expect(markReadRes.status).toBe(200);

      // No ?isRead — both notifications come back regardless of read state.
      const unfiltered = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${driverUser.accessToken}`);
      expect(unfiltered.status).toBe(200);
      expect(unfiltered.body.meta.total).toBe(2);

      // ?isRead=true / ?isRead=false still filter correctly.
      const readOnly = await request(app)
        .get("/api/v1/notifications?isRead=true")
        .set("Authorization", `Bearer ${driverUser.accessToken}`);
      expect(readOnly.body.meta.total).toBe(1);
      expect(readOnly.body.data[0]._id).toBe(notificationToMarkRead);

      const unreadOnly = await request(app)
        .get("/api/v1/notifications?isRead=false")
        .set("Authorization", `Bearer ${driverUser.accessToken}`);
      expect(unreadOnly.body.meta.total).toBe(1);
      expect(unreadOnly.body.data[0]._id).not.toBe(notificationToMarkRead);

      // Self-only unchanged — a different user's unfiltered list never sees these.
      const strangerUnfiltered = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${ownerA.accessToken}`);
      expect(strangerUnfiltered.status).toBe(200);
      const strangerIds = strangerUnfiltered.body.data.map((n: { _id: string }) => n._id);
      expect(strangerIds).not.toContain(notificationToMarkRead);
    }, 30000);
  });
});
