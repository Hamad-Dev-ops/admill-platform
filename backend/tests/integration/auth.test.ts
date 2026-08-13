import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "../../src/constants/role.enum";
import { app } from "../../src/app";
import { authMiddleware } from "../../src/middlewares/auth.middleware";
import { errorMiddleware } from "../../src/middlewares/error.middleware";
import { requireRole } from "../../src/middlewares/rbac.middleware";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { UserModel } from "../../src/models/user.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  // "1" prefix distinguishes this file's phone numbers from other test files sharing
  // the same real Atlas cluster, in case runId ever collides across files.
  return `1${runId}${phoneSeq}`;
}

function registerPayload(role: UserRole, tag: string) {
  return {
    firstName: "Test",
    lastName: tag,
    email: `m1-${tag}-${runId}@admill.test`,
    phone: uniquePhone(),
    password: "Password123!",
    role,
  };
}

function buildRbacTestApp() {
  const testApp = express();

  testApp.get("/test/owner-only", authMiddleware, requireRole(UserRole.OWNER), (_req, res) => {
    res.status(200).json({ success: true, data: "ok" });
  });

  testApp.use(errorMiddleware);

  return testApp;
}

describe("Auth & Identity (Milestone 1)", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    // Sweep by this file's email pattern rather than tracking created IDs in an array —
    // a test that throws mid-way (before pushing to a tracking array) would otherwise
    // leave orphaned documents in the real Atlas cluster, as happened once already.
    const testUsers = await UserModel.find({ email: /^m1-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);

    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });
    await disconnectTestDb();
  });

  it.each([UserRole.CUSTOMER, UserRole.DRIVER, UserRole.OWNER])("registers a new %s successfully", async (role) => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send(registerPayload(role, role.toLowerCase()));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe(role);
  });

  it("rejects registration with a duplicate email", async () => {
    const payload = registerPayload(UserRole.CUSTOMER, "dupe");
    const first = await request(app).post("/api/v1/auth/register").send(payload);

    const second = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...payload, phone: uniquePhone() });

    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
  });

  it("logs in successfully with correct credentials", async () => {
    const payload = registerPayload(UserRole.CUSTOMER, "login");
    const registerRes = await request(app).post("/api/v1/auth/register").send(payload);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: payload.email, password: payload.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("rejects login with the wrong password", async () => {
    const payload = registerPayload(UserRole.CUSTOMER, "wrongpw");
    const registerRes = await request(app).post("/api/v1/auth/register").send(payload);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: payload.email, password: "WrongPassword1!" });

    expect(res.status).toBe(401);
  });

  it("rotates the refresh token on use and rejects reuse of the old one", async () => {
    const payload = registerPayload(UserRole.CUSTOMER, "rotate");
    const registerRes = await request(app).post("/api/v1/auth/register").send(payload);

    const oldRefreshToken = registerRes.body.data.refreshToken;

    const refreshRes = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: oldRefreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.refreshToken).not.toBe(oldRefreshToken);

    const reuseRes = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: oldRefreshToken });
    expect(reuseRes.status).toBe(401);
  });

  it("revokes the refresh token on logout so it can no longer be used", async () => {
    const payload = registerPayload(UserRole.CUSTOMER, "logout");
    const registerRes = await request(app).post("/api/v1/auth/register").send(payload);

    const refreshToken = registerRes.body.data.refreshToken;

    const logoutRes = await request(app).post("/api/v1/auth/logout").send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    const reuseRes = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(reuseRes.status).toBe(401);
  });

  it("logs out of all devices, revoking every refresh token for that user", async () => {
    const payload = registerPayload(UserRole.CUSTOMER, "logoutall");
    const registerRes = await request(app).post("/api/v1/auth/register").send(payload);

    const accessToken = registerRes.body.data.accessToken;
    const firstRefreshToken = registerRes.body.data.refreshToken;

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: payload.email, password: payload.password });
    const secondRefreshToken = loginRes.body.data.refreshToken;

    const logoutAllRes = await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(logoutAllRes.status).toBe(200);

    const reuseFirst = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: firstRefreshToken });
    const reuseSecond = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: secondRefreshToken });

    expect(reuseFirst.status).toBe(401);
    expect(reuseSecond.status).toBe(401);
  });

  it("rejects a protected route when no access token is provided", async () => {
    const rbacApp = buildRbacTestApp();

    const res = await request(rbacApp).get("/test/owner-only");

    expect(res.status).toBe(401);
  });

  it("enforces RBAC: rejects a wrong-role user and allows the correct role", async () => {
    const customerPayload = registerPayload(UserRole.CUSTOMER, "rbaccust");
    const customerRes = await request(app).post("/api/v1/auth/register").send(customerPayload);

    const ownerPayload = registerPayload(UserRole.OWNER, "rbacowner");
    const ownerRes = await request(app).post("/api/v1/auth/register").send(ownerPayload);

    const rbacApp = buildRbacTestApp();

    const wrongRoleRes = await request(rbacApp)
      .get("/test/owner-only")
      .set("Authorization", `Bearer ${customerRes.body.data.accessToken}`);
    expect(wrongRoleRes.status).toBe(403);

    const correctRoleRes = await request(rbacApp)
      .get("/test/owner-only")
      .set("Authorization", `Bearer ${ownerRes.body.data.accessToken}`);
    expect(correctRoleRes.status).toBe(200);
  });
});
