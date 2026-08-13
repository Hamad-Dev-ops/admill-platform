import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { UserRole } from "../../src/constants/role.enum";
import { CustomerModel } from "../../src/models/customer.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { UserModel } from "../../src/models/user.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "4" prefix distinguishes this file's phone numbers from other test files sharing
  // the same real Atlas cluster.
  return `4${runId}${phoneSeq}`;
}

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m4-${tag}-${runId}@admill.test`,
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

describe("Customer Module (Milestone 4)", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    const testUsers = await UserModel.find({ email: /^m4-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    await CustomerModel.deleteMany({ userId: { $in: testUserIds } });
    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });
    await disconnectTestDb();
  });

  it("registers a customer profile with defaults and an atomic customerCode", async () => {
    const customer = await registerUser(UserRole.CUSTOMER, "register");

    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ nationalId: `NID-${runId}`, address: "Deira, Dubai" });

    expect(res.status).toBe(201);
    expect(res.body.data.customerCode).toMatch(/^CUS-\d{6}$/);
    expect(res.body.data.averageRating).toBe(0);
    expect(res.body.data.totalJobs).toBe(0);
  });

  it("rejects a second registration for the same user", async () => {
    const customer = await registerUser(UserRole.CUSTOMER, "dupe");

    const first = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ nationalId: `NID-${runId}-dupe` });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ nationalId: `NID-${runId}-dupe2` });
    expect(second.status).toBe(409);
  });

  it.each([UserRole.DRIVER, UserRole.OWNER])("rejects customer registration from a %s", async (role) => {
    const user = await registerUser(role, `wrongrole-${role.toLowerCase()}`);

    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ nationalId: `NID-${runId}` });

    expect(res.status).toBe(403);
  });

  it("populates identity from User rather than storing it on Customer, and never returns the password", async () => {
    const customer = await registerUser(UserRole.CUSTOMER, "identity");

    await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ nationalId: `NID-${runId}-identity` });

    const res = await request(app).get("/api/v1/customers/me").set("Authorization", `Bearer ${customer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId.email).toBe(customer.email);
    expect(res.body.data.userId.firstName).toBe("Test");
    expect(res.body.data.password).toBeUndefined();
  });

  it("404s when fetching a profile that was never registered", async () => {
    const customer = await registerUser(UserRole.CUSTOMER, "neverregistered");

    const res = await request(app)
      .get("/api/v1/customers/me")
      .set("Authorization", `Bearer ${customer.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("updates editable fields but ignores an attempt to set averageRating/totalJobs directly", async () => {
    const customer = await registerUser(UserRole.CUSTOMER, "update");

    await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ nationalId: `NID-${runId}-update`, address: "Old Address" });

    const res = await request(app)
      .patch("/api/v1/customers/me")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      // averageRating/totalJobs aren't in the update schema, so Zod strips them before
      // they ever reach the service — this is what makes them "read-only via this API".
      .send({ address: "New Address", averageRating: 999, totalJobs: 999 });

    expect(res.status).toBe(200);
    expect(res.body.data.address).toBe("New Address");
    expect(res.body.data.averageRating).toBe(0);
    expect(res.body.data.totalJobs).toBe(0);
  });
});
