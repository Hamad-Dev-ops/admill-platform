import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { DriverStatus } from "../../src/constants/driver.enum";
import { UserRole } from "../../src/constants/role.enum";
import { ServiceType } from "../../src/constants/service.enum";
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { CustomerModel } from "../../src/models/customer.model";
import { DriverModel } from "../../src/models/driver.model";
import { JobModel } from "../../src/models/job.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { ServiceModel } from "../../src/models/service.model";
import { UserModel } from "../../src/models/user.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";
import { withDefaultCompany } from "../setup/defaultCompany";

// Gap #14 (GAP-REPORT.md): POST /jobs no longer accepts companyId from the
// Customer at all — the backend resolves the platform's operational company
// itself via DEFAULT_COMPANY_CODE (job.service.ts's resolveOperationalCompany).
// This file covers exactly that resolution behavior; job.test.ts (Milestone 6)
// continues to cover the full dispatch/lifecycle behavior once a company is
// resolved, unchanged.

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "14" prefix distinguishes this file's phone numbers from other test files
  // sharing the same real Atlas cluster.
  return `14${runId}${phoneSeq}`;
}

const JOB_SERVICE_TYPE = ServiceType.BIKE_TOWING;
const PICKUP = { type: "Point" as const, coordinates: [55.2744, 25.1972] as [number, number] };
const DESTINATION = { type: "Point" as const, coordinates: [55.14, 25.08] as [number, number] };
const NEAR_DRIVER_LOCATION: [number, number] = [55.275, 25.198];

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `gap14-${tag}-${runId}@admill.test`,
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

async function makeDriverAvailableAt(accessToken: string, coordinates: [number, number]) {
  await request(app)
    .patch("/api/v1/drivers/me/location")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ location: { type: "Point", coordinates } });
  await request(app)
    .patch("/api/v1/drivers/me/status")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ status: DriverStatus.AVAILABLE });
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

function jobPayload(extra: Record<string, unknown> = {}) {
  return {
    serviceType: JOB_SERVICE_TYPE,
    pickupLocation: { geo: PICKUP, address: "Burj Khalifa, Dubai" },
    destinationLocation: { geo: DESTINATION, address: "Dubai Marina, Dubai" },
    ...extra,
  };
}

// Points DEFAULT_COMPANY_CODE at `companyCode` for the duration of exactly
// this one request, then restores it — even if the request throws.
async function createJobAs(customerToken: string, companyCode: string | undefined, extra: Record<string, unknown> = {}) {
  const restore = companyCode !== undefined ? withDefaultCompany(companyCode) : () => {};
  if (companyCode === undefined) delete process.env.DEFAULT_COMPANY_CODE;

  try {
    return await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${customerToken}`)
      .send(jobPayload(extra));
  } finally {
    restore();
  }
}

describe("Job creation — default operational company resolution (Gap #14)", () => {
  let preExistingServiceIds: string[] = [];

  beforeAll(async () => {
    await connectTestDb();
    preExistingServiceIds = (await ServiceModel.find().select("_id")).map((s) => s._id.toString());
  });

  afterEach(() => {
    // Belt-and-braces — every `it` below manages its own DEFAULT_COMPANY_CODE
    // explicitly, but this guarantees no accidental leftover value survives
    // into the next test in this file or the next file in the run
    // (fileParallelism:false).
    delete process.env.DEFAULT_COMPANY_CODE;
  });

  afterAll(async () => {
    const testUsers = await UserModel.find({ email: /^gap14-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    const testDrivers = await DriverModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testDriverIds = testDrivers.map((d) => d._id);

    const testCustomers = await CustomerModel.find({ userId: { $in: testUserIds } }).select("_id");
    const testCustomerIds = testCustomers.map((c) => c._id);

    const testJobs = await JobModel.find({ companyId: { $in: testCompanyIds } }).select("_id");

    await JobModel.deleteMany({ _id: { $in: testJobs.map((j) => j._id) } });
    await CustomerModel.deleteMany({ _id: { $in: testCustomerIds } });
    await DriverModel.deleteMany({ _id: { $in: testDriverIds } });
    await CompanySettingsModel.deleteMany({ companyId: { $in: testCompanyIds } });
    await CompanyModel.deleteMany({ _id: { $in: testCompanyIds } });
    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });
    await ServiceModel.deleteMany({ _id: { $nin: preExistingServiceIds } });

    await disconnectTestDb();
  });

  it("creates a job from exactly {serviceType, pickupLocation, destinationLocation} — no companyId required or accepted", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("create");
    const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "createdriver");
    await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

    const res = await createJobAs(customer.accessToken, company.companyCode);

    expect(res.status).toBe(201);
    expect(res.body.data.serviceType).toBe(JOB_SERVICE_TYPE);

    // The resolved operational company's real _id is what's actually stored
    // on the job — not fabricated, not left unset.
    const stored = await JobModel.findById(res.body.data._id);
    expect(stored?.companyId.toString()).toBe(company._id);
    expect(res.body.data.companyId).toBe(company._id);
  });

  it("silently ignores a companyId field if a stale/uncooperative client still sends one — never lets the client pick the company", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("ignoreid");
    const driver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "ignoreiddriver");
    await makeDriverAvailableAt(driver.accessToken, NEAR_DRIVER_LOCATION);

    // A second, unrelated company the (fictional) malicious/stale client
    // might try to force by supplying its id directly.
    const otherOwner = await registerUser(UserRole.OWNER, "ignoreidotherowner");
    const otherCompany = await createCompanyForOwner(otherOwner.accessToken, "ignoreidother");

    const res = await createJobAs(customer.accessToken, company.companyCode, { companyId: otherCompany._id });

    expect(res.status).toBe(201);
    // Resolved via DEFAULT_COMPANY_CODE, not the attempted companyId override.
    expect(res.body.data.companyId).toBe(company._id);
    expect(res.body.data.companyId).not.toBe(otherCompany._id);
  });

  it("returns a 500 server-configuration error, not a 400/404, when DEFAULT_COMPANY_CODE is unset", async () => {
    const { customer } = await createCompanyOwnerAndCustomer("unsetconfig");

    const res = await createJobAs(customer.accessToken, undefined);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    // Message is customer-safe — never names the env var or exposes internal config.
    expect(res.body.message).not.toMatch(/DEFAULT_COMPANY_CODE/);
    expect(res.body.message).toMatch(/temporarily unavailable/i);
  });

  it("returns a 500 server-configuration error, not a 400/404, when DEFAULT_COMPANY_CODE points at a company that doesn't exist", async () => {
    const { customer } = await createCompanyOwnerAndCustomer("badconfig");

    const res = await createJobAs(customer.accessToken, `CMP-DOES-NOT-EXIST-${runId}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).not.toMatch(/DEFAULT_COMPANY_CODE/);
  });

  it("still snapshots only the resolved company's nearby AVAILABLE drivers into offeredDriverIds — dispatch scoping is unchanged", async () => {
    const { owner, company, customer } = await createCompanyOwnerAndCustomer("dispatch");
    const inCompanyDriver = await registerAndApproveDriver(owner.accessToken, company.companyCode, "dispatchin");
    await makeDriverAvailableAt(inCompanyDriver.accessToken, NEAR_DRIVER_LOCATION);

    // A driver belonging to a different company, physically just as near —
    // must never be offered this job, proving dispatch is still scoped by
    // the resolved company, not just by proximity.
    const otherOwner = await registerUser(UserRole.OWNER, "dispatchotherowner");
    const otherCompany = await createCompanyForOwner(otherOwner.accessToken, "dispatchother");
    await ensureServiceCatalogEntry(otherOwner.accessToken);
    const otherCompanyDriver = await registerAndApproveDriver(otherOwner.accessToken, otherCompany.companyCode, "dispatchout");
    await makeDriverAvailableAt(otherCompanyDriver.accessToken, NEAR_DRIVER_LOCATION);

    const res = await createJobAs(customer.accessToken, company.companyCode);

    expect(res.status).toBe(201);
    expect(res.body.data.offeredDriverIds).toContain(inCompanyDriver.driverId);
    expect(res.body.data.offeredDriverIds).not.toContain(otherCompanyDriver.driverId);
  }, 30000);
});
