import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { UserRole } from "../../src/constants/role.enum";
import { CompanyModel } from "../../src/models/company.model";
import { CompanySettingsModel } from "../../src/models/companySettings.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { UserModel } from "../../src/models/user.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "2" prefix distinguishes this file's phone numbers from other test files sharing
  // the same real Atlas cluster, in case runId ever collides across files.
  return `2${runId}${phoneSeq}`;
}

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m2-${tag}-${runId}@admill.test`,
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

function companyPayload(tag: string) {
  return {
    companyName: `Test Recovery Co ${tag}`,
    email: `company-${tag}-${runId}@admill.test`,
    phone: uniquePhone(),
    address: "123 Sheikh Zayed Rd",
    city: "Dubai",
    country: "UAE",
    tradeLicenseNumber: `TL-${runId}-${tag}`,
    tradeLicenseExpiry: "2030-01-01",
    serviceAreas: ["Dubai", "Sharjah"],
  };
}

describe("Company & Settings (Milestone 2)", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    // Sweep by this file's email pattern rather than tracking created IDs in an array —
    // a test that throws mid-way would otherwise leave orphaned documents in the real
    // Atlas cluster (this happened once already during Milestone 2 development).
    const testUsers = await UserModel.find({ email: /^m2-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    const testCompanies = await CompanyModel.find({ ownerId: { $in: testUserIds } }).select("_id");
    const testCompanyIds = testCompanies.map((c) => c._id);

    await CompanySettingsModel.deleteMany({ companyId: { $in: testCompanyIds } });
    await CompanyModel.deleteMany({ _id: { $in: testCompanyIds } });
    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });
    await disconnectTestDb();
  });

  it("lets an owner create a company with an atomically-generated companyCode", async () => {
    const owner = await registerUser(UserRole.OWNER, "create");

    const res = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(companyPayload("create"));

    expect(res.status).toBe(201);
    expect(res.body.data.companyCode).toMatch(/^CMP-\d{6}$/);
  });

  it.each([UserRole.CUSTOMER, UserRole.DRIVER])("rejects company creation from a %s", async (role) => {
    const user = await registerUser(role, `reject-${role.toLowerCase()}`);

    const res = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send(companyPayload(`reject-${role.toLowerCase()}`));

    expect(res.status).toBe(403);
  });

  it("rejects a second company from the same owner", async () => {
    const owner = await registerUser(UserRole.OWNER, "dupe");

    const first = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(companyPayload("dupe1"));

    const second = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(companyPayload("dupe2"));

    expect(second.status).toBe(409);
  });

  it("fetches and updates the owner's own company via /me", async () => {
    const owner = await registerUser(UserRole.OWNER, "meflow");

    const createRes = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(companyPayload("meflow"));

    const getRes = await request(app)
      .get("/api/v1/companies/me")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.companyCode).toBe(createRes.body.data.companyCode);

    const patchRes = await request(app)
      .patch("/api/v1/companies/me")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ companyName: "Renamed Recovery Co" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.companyName).toBe("Renamed Recovery Co");
  });

  it("defaults settings sensibly without any prior configuration", async () => {
    const owner = await registerUser(UserRole.OWNER, "defaults");

    const createRes = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(companyPayload("defaults"));

    const res = await request(app)
      .get("/api/v1/companies/me/settings")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.operatingHours).toEqual({ open: "08:00", close: "20:00" });
    expect(res.body.data.defaultServiceRadiusKm).toBe(15);
    expect(res.body.data.notificationPreferences).toEqual({ email: true, sms: true, push: true });
  });

  it("partially updates nested settings without clobbering sibling fields", async () => {
    const owner = await registerUser(UserRole.OWNER, "partial");

    const createRes = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(companyPayload("partial"));

    const patchRes = await request(app)
      .patch("/api/v1/companies/me/settings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ operatingHours: { open: "09:00" } });

    expect(patchRes.status).toBe(200);
    // `close` must survive the partial update to `open` — this is the exact bug
    // a naive $set on the whole subdocument would introduce.
    expect(patchRes.body.data.operatingHours).toEqual({ open: "09:00", close: "20:00" });
    expect(patchRes.body.data.notificationPreferences).toEqual({ email: true, sms: true, push: true });
  });

  it(
    "never produces a duplicate companyCode under concurrent creation (Counter atomicity)",
    async () => {
      const owners = await Promise.all(
        Array.from({ length: 8 }, (_, i) => registerUser(UserRole.OWNER, `race${i}`))
      );

      const responses = await Promise.all(
        owners.map((owner, i) =>
          request(app)
            .post("/api/v1/companies")
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send(companyPayload(`race${i}`))
        )
      );

      responses.forEach((res) => {
        expect(res.status).toBe(201);
      });

      const codes = responses.map((res) => res.body.data.companyCode);
      expect(new Set(codes).size).toBe(codes.length);
    },
    20000
  );
});
