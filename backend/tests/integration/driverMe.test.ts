import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { UserRole } from "../../src/constants/role.enum";
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { DriverModel } from "../../src/models/driver.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { UserModel } from "../../src/models/user.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";

// GET /drivers/me — added post-Milestone-11 to support the mobile app's Driver
// Experience phase (frontend-docs/GAP-REPORT.md gap #10). Kept as its own small
// file rather than folded into driver-vehicle-document.test.ts, following this
// project's established per-file-helper convention.

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "9" prefix distinguishes this file's phone numbers from other test files
  // sharing the same real Atlas cluster.
  return `9${runId}${phoneSeq}`;
}

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `driverme-${tag}-${runId}@admill.test`,
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

describe("GET /drivers/me", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    const testUsers = await UserModel.find({ email: /^driverme-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    const testDrivers = await DriverModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testDriverIds = testDrivers.map((d) => d._id);

    await DriverModel.deleteMany({ _id: { $in: testDriverIds } });
    await CompanySettingsModel.deleteMany({ companyId: { $in: testCompanyIds } });
    await CompanyModel.deleteMany({ _id: { $in: testCompanyIds } });
    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });
    await disconnectTestDb();
  });

  it("returns the authenticated driver's own profile, identity-populated", async () => {
    const owner = await registerUser(UserRole.OWNER, "meowner");
    const company = await createCompanyForOwner(owner.accessToken, "me");
    const driver = await registerUser(UserRole.DRIVER, "medriver");

    const registerRes = await request(app)
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({
        companyCode: company.companyCode,
        nationalId: `NID-${runId}`,
        emiratesId: `784-${runId}`,
        emiratesIdExpiry: "2030-01-01",
        drivingLicenseNumber: `DL-${runId}`,
        drivingLicenseExpiry: "2030-01-01",
      });
    expect(registerRes.status).toBe(201);
    const driverId = registerRes.body.data._id as string;

    const meRes = await request(app)
      .get("/api/v1/drivers/me")
      .set("Authorization", `Bearer ${driver.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data._id).toBe(driverId);
    expect(meRes.body.data.employeeId).toMatch(/^DRV-\d{6}$/);
    expect(meRes.body.data.approvalStatus).toBe("PENDING_APPROVAL");
    // Identity populated from User, same as GET /drivers/:id — never duplicated
    // onto Driver (architecture-baseline.md Decision #1).
    expect(meRes.body.data.userId).toMatchObject({
      firstName: "Test",
      lastName: "medriver",
      email: driver.email,
    });
  });

  it("returns 404 for a DRIVER-role user who never completed driver registration", async () => {
    const user = await registerUser(UserRole.DRIVER, "noprofile");

    const res = await request(app)
      .get("/api/v1/drivers/me")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Driver profile not found");
  });

  it("rejects a non-DRIVER role with 403", async () => {
    const owner = await registerUser(UserRole.OWNER, "wrongrole");

    const res = await request(app)
      .get("/api/v1/drivers/me")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/v1/drivers/me");
    expect(res.status).toBe(401);
  });

  it("reflects updated approval status after an owner approves the driver", async () => {
    const owner = await registerUser(UserRole.OWNER, "approveowner");
    const company = await createCompanyForOwner(owner.accessToken, "approve");
    const driver = await registerUser(UserRole.DRIVER, "approvedriver");

    const registerRes = await request(app)
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({
        companyCode: company.companyCode,
        nationalId: `NID-appr-${runId}`,
        emiratesId: `784-appr-${runId}`,
        emiratesIdExpiry: "2030-01-01",
        drivingLicenseNumber: `DL-appr-${runId}`,
        drivingLicenseExpiry: "2030-01-01",
      });
    const driverId = registerRes.body.data._id as string;

    await request(app)
      .patch(`/api/v1/drivers/${driverId}/approve`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const meRes = await request(app)
      .get("/api/v1/drivers/me")
      .set("Authorization", `Bearer ${driver.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.approvalStatus).toBe("APPROVED");
  });
});
