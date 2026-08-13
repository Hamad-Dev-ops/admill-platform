import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { UserRole } from "../../src/constants/role.enum";
import { fileStorageProvider } from "../../src/infrastructure/providers/fileStorage/cloudinary.provider";
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { DocumentModel } from "../../src/models/document.model";
import { DriverModel } from "../../src/models/driver.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { UserModel } from "../../src/models/user.model";
import { VehicleModel } from "../../src/models/vehicle.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "3" prefix distinguishes this file's phone numbers from other test files sharing
  // the same real Atlas cluster.
  return `3${runId}${phoneSeq}`;
}

// A well-known minimal valid 1x1 JPEG, so the real Cloudinary upload test uploads
// actual decodable image bytes rather than arbitrary garbage.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64"
);

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m3-${tag}-${runId}@admill.test`,
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

function driverRegistrationPayload(companyCode: string) {
  return {
    companyCode,
    nationalId: `NID-${runId}`,
    emiratesId: `784-${runId}`,
    emiratesIdExpiry: "2030-01-01",
    drivingLicenseNumber: `DL-${runId}`,
    drivingLicenseExpiry: "2030-01-01",
  };
}

describe("Driver, Vehicle & Document Management (Milestone 3)", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    // Note: "company-*" emails belong to Company documents, not Users, so this only
    // needs to match this file's User emails (m3-*); companies are swept below via
    // their ownerId pointing at these users, not by their own email field.
    const testUsers = await UserModel.find({ email: /^m3-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    const testDrivers = await DriverModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testDriverIds = testDrivers.map((d) => d._id);

    const testVehicles = await VehicleModel.find({ companyId: { $in: testCompanyIds } }).select("_id");
    const testVehicleIds = testVehicles.map((v) => v._id);

    const documentFilter = {
      $or: [
        { ownerType: "DRIVER", ownerId: { $in: testDriverIds } },
        { ownerType: "VEHICLE", ownerId: { $in: testVehicleIds } },
        { ownerType: "COMPANY", ownerId: { $in: testCompanyIds } },
      ],
    };

    const testDocuments = await DocumentModel.find(documentFilter).select("fileUrl");
    // Precise per-asset delete (not a folder-prefix wipe) — production documents will
    // eventually live in these same Cloudinary folders once this app is live.
    await Promise.all(testDocuments.map((d) => fileStorageProvider.deleteByUrl(d.fileUrl)));

    await DocumentModel.deleteMany(documentFilter);
    await VehicleModel.deleteMany({ _id: { $in: testVehicleIds } });
    await DriverModel.deleteMany({ _id: { $in: testDriverIds } });
    await CompanySettingsModel.deleteMany({ companyId: { $in: testCompanyIds } });
    await CompanyModel.deleteMany({ _id: { $in: testCompanyIds } });
    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });
    await disconnectTestDb();
  });

  it("looks up a company by its code and rejects an unknown code", async () => {
    const owner = await registerUser(UserRole.OWNER, "lookupowner");
    const company = await createCompanyForOwner(owner.accessToken, "lookup");

    const found = await request(app)
      .get(`/api/v1/companies/lookup/${company.companyCode}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(found.status).toBe(200);
    expect(found.body.data.companyName).toBe("Test Recovery Co lookup");

    const notFound = await request(app)
      .get("/api/v1/companies/lookup/CMP-999999")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(notFound.status).toBe(404);
  });

  it("rejects driver self-registration against an invalid company code", async () => {
    const driver = await registerUser(UserRole.DRIVER, "badcode");

    const res = await request(app)
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send(driverRegistrationPayload("CMP-999999"));

    expect(res.status).toBe(404);
  });

  it("runs the full happy path: register -> document upload -> verify -> approve -> vehicle -> assign", async () => {
    const owner = await registerUser(UserRole.OWNER, "happyowner");
    const company = await createCompanyForOwner(owner.accessToken, "happy");

    const driver = await registerUser(UserRole.DRIVER, "happydriver");

    const registerRes = await request(app)
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send(driverRegistrationPayload(company.companyCode));

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.employeeId).toMatch(/^DRV-\d{6}$/);
    expect(registerRes.body.data.approvalStatus).toBe("PENDING_APPROVAL");

    const driverId = registerRes.body.data._id;

    // Duplicate registration for the same user is rejected.
    const dupeRes = await request(app)
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send(driverRegistrationPayload(company.companyCode));
    expect(dupeRes.status).toBe(409);

    // The driver can view their own record; an unrelated driver cannot.
    const otherDriver = await registerUser(UserRole.DRIVER, "outsider");
    const outsiderRes = await request(app)
      .get(`/api/v1/drivers/${driverId}`)
      .set("Authorization", `Bearer ${otherDriver.accessToken}`);
    expect(outsiderRes.status).toBe(403);

    const selfRes = await request(app)
      .get(`/api/v1/drivers/${driverId}`)
      .set("Authorization", `Bearer ${driver.accessToken}`);
    expect(selfRes.status).toBe(200);
    // Decision #4/§3.3: identity comes from User via population, never duplicated onto Driver.
    expect(selfRes.body.data.userId.email).toBe(driver.email);
    expect(selfRes.body.data.password).toBeUndefined();

    // Owner's pending-review queue includes this driver.
    const listRes = await request(app)
      .get("/api/v1/drivers?approvalStatus=PENDING_APPROVAL")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((d: { _id: string }) => d._id === driverId)).toBe(true);
    expect(listRes.body.meta.total).toBeGreaterThanOrEqual(1);

    // Document upload rejects a disallowed file type.
    const badUpload = await request(app)
      .post(`/api/v1/drivers/${driverId}/documents`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .field("documentType", "EMIRATES_ID")
      .attach("file", Buffer.from("not a real file"), { filename: "notes.txt", contentType: "text/plain" });
    expect(badUpload.status).toBe(400);

    // A valid upload actually lands in Cloudinary (real upload, not mocked).
    const uploadRes = await request(app)
      .post(`/api/v1/drivers/${driverId}/documents`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .field("documentType", "EMIRATES_ID")
      .attach("file", TINY_JPEG, { filename: "emirates-id.jpg", contentType: "image/jpeg" });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.fileUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(uploadRes.body.data.verificationStatus).toBe("PENDING");

    const firstDocumentId = uploadRes.body.data._id;

    // Non-owner cannot verify documents.
    const verifyByDriverRes = await request(app)
      .patch(`/api/v1/documents/${firstDocumentId}/verify`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ status: "VERIFIED" });
    expect(verifyByDriverRes.status).toBe(403);

    // Owner rejects the document...
    const rejectRes = await request(app)
      .patch(`/api/v1/documents/${firstDocumentId}/verify`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "REJECTED", rejectionReason: "Photo is blurry" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.verificationStatus).toBe("REJECTED");

    // ...driver re-uploads a replacement.
    const reuploadRes = await request(app)
      .post(`/api/v1/drivers/${driverId}/documents`)
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .field("documentType", "EMIRATES_ID")
      .attach("file", TINY_JPEG, { filename: "emirates-id-v2.jpg", contentType: "image/jpeg" });
    expect(reuploadRes.status).toBe(201);

    const secondDocumentId = reuploadRes.body.data._id;

    const verifyRes = await request(app)
      .patch(`/api/v1/documents/${secondDocumentId}/verify`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "VERIFIED" });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verificationStatus).toBe("VERIFIED");

    const documentsListRes = await request(app)
      .get(`/api/v1/drivers/${driverId}/documents`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(documentsListRes.status).toBe(200);
    expect(documentsListRes.body.data).toHaveLength(2);

    // A different company's owner cannot approve this driver.
    const otherOwner = await registerUser(UserRole.OWNER, "otherowner");
    await createCompanyForOwner(otherOwner.accessToken, "other");
    const crossApproveRes = await request(app)
      .patch(`/api/v1/drivers/${driverId}/approve`)
      .set("Authorization", `Bearer ${otherOwner.accessToken}`);
    expect(crossApproveRes.status).toBe(403);

    // The correct owner approves.
    const approveRes = await request(app)
      .patch(`/api/v1/drivers/${driverId}/approve`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.approvalStatus).toBe("APPROVED");

    // Vehicle creation is owner-only.
    const vehiclePayload = {
      plateNumber: `P-${runId}`,
      registrationNumber: `REG-${runId}`,
      chassisNumber: `CHS-${runId}`,
      vehicleType: "TOW_TRUCK",
      recoveryType: ["CAR_TOWING"],
      insurancePolicyNumber: `INS-${runId}`,
      insuranceExpiry: "2030-01-01",
      registrationExpiry: "2030-01-01",
    };

    const vehicleByDriverRes = await request(app)
      .post("/api/v1/vehicles")
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send(vehiclePayload);
    expect(vehicleByDriverRes.status).toBe(403);

    const vehicleRes = await request(app)
      .post("/api/v1/vehicles")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(vehiclePayload);
    expect(vehicleRes.status).toBe(201);
    expect(vehicleRes.body.data.vehicleCode).toMatch(/^VEH-\d{6}$/);

    const vehicleId = vehicleRes.body.data._id;

    // Assigning a driver from a different company is rejected.
    const otherCompanyDriver = await registerUser(UserRole.DRIVER, "othercompanydriver");
    const otherCompany = await createCompanyForOwner(
      (await registerUser(UserRole.OWNER, "othercompanyowner")).accessToken,
      "othercompany"
    );
    const otherDriverRegRes = await request(app)
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${otherCompanyDriver.accessToken}`)
      .send(driverRegistrationPayload(otherCompany.companyCode));

    const crossAssignRes = await request(app)
      .post(`/api/v1/vehicles/${vehicleId}/assign-driver`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ driverId: otherDriverRegRes.body.data._id });
    expect(crossAssignRes.status).toBe(409);

    // Assigning the correct, same-company driver succeeds.
    const assignRes = await request(app)
      .post(`/api/v1/vehicles/${vehicleId}/assign-driver`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ driverId });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.assignedDriver).toBe(driverId);

    // The assigned driver can now view the vehicle; an unrelated driver still cannot.
    const assignedViewRes = await request(app)
      .get(`/api/v1/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${driver.accessToken}`);
    expect(assignedViewRes.status).toBe(200);

    const unrelatedViewRes = await request(app)
      .get(`/api/v1/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${otherDriver.accessToken}`);
    expect(unrelatedViewRes.status).toBe(403);

    // Owner's fleet list includes the vehicle, with pagination meta.
    const fleetRes = await request(app)
      .get("/api/v1/vehicles")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(fleetRes.status).toBe(200);
    expect(fleetRes.body.data.some((v: { _id: string }) => v._id === vehicleId)).toBe(true);
    expect(fleetRes.body.meta).toEqual({ page: 1, limit: 20, total: expect.any(Number) });
  }, 30000);

  it("stores expiry dates queryably on Driver and Vehicle directly", async () => {
    const owner = await registerUser(UserRole.OWNER, "expiryowner");
    const company = await createCompanyForOwner(owner.accessToken, "expiry");
    const driver = await registerUser(UserRole.DRIVER, "expirydriver");

    const pastExpiry = "2020-01-01";
    const registerRes = await request(app)
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${driver.accessToken}`)
      .send({ ...driverRegistrationPayload(company.companyCode), emiratesIdExpiry: pastExpiry });
    expect(registerRes.status).toBe(201);

    const expiredCount = await DriverModel.countDocuments({
      companyId: company._id,
      emiratesIdExpiry: { $lt: new Date() },
    });
    expect(expiredCount).toBeGreaterThanOrEqual(1);
  });
});
