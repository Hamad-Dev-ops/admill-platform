import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { UserRole } from "../../src/constants/role.enum";
import { ServiceType } from "../../src/constants/service.enum";
import { distanceProvider } from "../../src/infrastructure/providers/distance/openRouteService.provider";
import { PricingConfigModel } from "../../src/models/pricingConfig.model";
import { RefreshTokenModel } from "../../src/models/refreshToken.model";
import { ServiceModel } from "../../src/models/service.model";
import { UserModel } from "../../src/models/user.model";
import { connectTestDb, disconnectTestDb } from "../setup/db";

// Asks the same provider PricingService actually uses for the "expected" distance,
// rather than assuming Haversine — correct whether OPENROUTESERVICE_API_KEY is
// configured (real road routing) or not (Haversine fallback), instead of only being
// correct in the one environment where no key exists.
async function expectedDistanceKmFor(
  pickup: { type: string; coordinates: number[] },
  destination: { type: string; coordinates: number[] }
): Promise<number> {
  const route = await distanceProvider.getRoute(
    { type: "Point", coordinates: pickup.coordinates as [number, number] },
    { type: "Point", coordinates: destination.coordinates as [number, number] }
  );
  return route.distanceKm;
}

const runId = Date.now();
let phoneSeq = 0;

function uniquePhone(): string {
  phoneSeq += 1;
  return `5${runId}${phoneSeq}`;
}

async function registerUser(role: UserRole, tag: string) {
  const payload = {
    firstName: "Test",
    lastName: tag,
    email: `m5-${tag}-${runId}@admill.test`,
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

const PICKUP = { type: "Point", coordinates: [55.2744, 25.1972] }; // Burj Khalifa area
const DESTINATION = { type: "Point", coordinates: [55.14, 25.08] }; // Dubai Marina area

describe("Service Catalog & Pricing Engine (Milestone 5)", () => {
  let preExistingServiceIds: string[] = [];
  let preExistingConfigIds: string[] = [];

  beforeAll(async () => {
    await connectTestDb();
    // Both collections are global (not scoped to a test-run-specific ID), so snapshot
    // what already existed and only clean up what this file actually adds.
    preExistingServiceIds = (await ServiceModel.find().select("_id")).map((s) => s._id.toString());
    preExistingConfigIds = (await PricingConfigModel.find().select("_id")).map((c) => c._id.toString());
  });

  afterAll(async () => {
    const testUsers = await UserModel.find({ email: /^m5-.*@admill\.test$/ }).select("_id");
    const testUserIds = testUsers.map((u) => u._id);
    await RefreshTokenModel.deleteMany({ userId: { $in: testUserIds } });
    await UserModel.deleteMany({ _id: { $in: testUserIds } });

    await ServiceModel.deleteMany({ _id: { $nin: preExistingServiceIds } });
    await PricingConfigModel.deleteMany({ _id: { $nin: preExistingConfigIds } });

    await disconnectTestDb();
  });

  it("creates a service catalog entry with an atomic serviceCode, rejects duplicates and non-owners", async () => {
    const owner = await registerUser(UserRole.OWNER, "catalogowner");
    const customer = await registerUser(UserRole.CUSTOMER, "catalogcustomer");

    // A real CAR_TOWING catalog entry may already exist in this shared environment
    // (e.g. seeded for a live demo) — this test needs a genuine "doesn't exist yet"
    // creation to exercise the atomic-serviceCode path, so temporarily remove any
    // existing one and restore the exact original document afterward. Never
    // invents a value; only ever removes/restores what was already really there.
    const existingCarTowing = await ServiceModel.findOne({ serviceType: ServiceType.CAR_TOWING }).lean();
    if (existingCarTowing) {
      await ServiceModel.deleteOne({ _id: existingCarTowing._id });
    }

    try {
      const rejectedRes = await request(app)
        .post("/api/v1/services")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ serviceType: ServiceType.CAR_TOWING, displayName: "Car Towing", baseFare: 50 });
      expect(rejectedRes.status).toBe(403);

      const createRes = await request(app)
        .post("/api/v1/services")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ serviceType: ServiceType.CAR_TOWING, displayName: "Car Towing", baseFare: 50 });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.serviceCode).toMatch(/^SVC-\d{6}$/);

      const dupeRes = await request(app)
        .post("/api/v1/services")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ serviceType: ServiceType.CAR_TOWING, displayName: "Car Towing Again", baseFare: 60 });
      expect(dupeRes.status).toBe(409);

      const listRes = await request(app).get("/api/v1/services").set("Authorization", `Bearer ${owner.accessToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((s: { serviceType: string }) => s.serviceType === ServiceType.CAR_TOWING)).toBe(
        true
      );
    } finally {
      // Remove whatever this test created (its own new entry), then restore the
      // real original document exactly as it was, including its original _id —
      // already covered by preExistingServiceIds, so the outer afterAll leaves it
      // alone too.
      await ServiceModel.deleteMany({ serviceType: ServiceType.CAR_TOWING });
      if (existingCarTowing) {
        await ServiceModel.create(existingCarTowing);
      }
    }
  });

  it("returns a real itemized fare estimate wired through all 6 active factors", async () => {
    const owner = await registerUser(UserRole.OWNER, "estimateowner");

    await request(app)
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ serviceType: ServiceType.JUMP_START, displayName: "Jump Start", baseFare: 20 });

    const configRes = await request(app)
      .get("/api/v1/pricing/config")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(configRes.status).toBe(200);
    const config = configRes.body.data;

    const estimateRes = await request(app)
      .post("/api/v1/pricing/estimate")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ serviceType: ServiceType.JUMP_START, pickupLocation: PICKUP, destinationLocation: DESTINATION });

    expect(estimateRes.status).toBe(200);
    const breakdown = estimateRes.body.data;

    const factorNames = breakdown.factors.map((f: { name: string }) => f.name).sort();
    expect(factorNames).toEqual(["baseService", "demand", "distance", "fuelPrice", "time", "weather"].sort());

    const expectedDistanceKm = await expectedDistanceKmFor(PICKUP, DESTINATION);

    const baseService = breakdown.factors.find((f: { name: string }) => f.name === "baseService");
    const distance = breakdown.factors.find((f: { name: string }) => f.name === "distance");
    const fuelPrice = breakdown.factors.find((f: { name: string }) => f.name === "fuelPrice");
    const weather = breakdown.factors.find((f: { name: string }) => f.name === "weather");
    const demand = breakdown.factors.find((f: { name: string }) => f.name === "demand");

    expect(baseService.amount).toBe(20);
    expect(distance.amount).toBeCloseTo(expectedDistanceKm * config.perKmRate, 1);
    expect(fuelPrice.amount).toBeCloseTo(
      expectedDistanceKm * config.fuelConsumptionPerKm * config.currentFuelPrice,
      1
    );
    // Weather/demand come from live external state / real driver-supply data, so we
    // can only assert they fall within the set of legitimate values, not an exact
    // number — the exact-value cases are covered deterministically in
    // tests/unit/pricing.factors.test.ts.
    expect([0, 10, 20, 25]).toContain(weather.amount);
    expect(demand.amount).toBeGreaterThanOrEqual(0);
    expect(demand.amount).toBeLessThanOrEqual(config.maxDemandSurcharge);

    const sumOfFactors = breakdown.factors.reduce((sum: number, f: { amount: number }) => sum + f.amount, 0);
    expect(breakdown.total).toBeCloseTo(sumOfFactors, 2);
  });

  it("404s an estimate for a service type with no catalog entry", async () => {
    const owner = await registerUser(UserRole.OWNER, "noservice");

    // Same shared-environment concern as the catalog-creation test above — a real
    // FUEL_DELIVERY entry may already exist; temporarily remove it so this test can
    // genuinely exercise the "no catalog entry" 404 path, then restore the exact
    // original document afterward.
    const existingFuelDelivery = await ServiceModel.findOne({ serviceType: ServiceType.FUEL_DELIVERY }).lean();
    if (existingFuelDelivery) {
      await ServiceModel.deleteOne({ _id: existingFuelDelivery._id });
    }

    try {
      const res = await request(app)
        .post("/api/v1/pricing/estimate")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          serviceType: ServiceType.FUEL_DELIVERY,
          pickupLocation: PICKUP,
          destinationLocation: DESTINATION,
        });

      expect(res.status).toBe(404);
    } finally {
      if (existingFuelDelivery) {
        await ServiceModel.create(existingFuelDelivery);
      }
    }
  });

  it("versions PricingConfig on update and reflects the new fuel price in the next estimate immediately", async () => {
    const owner = await registerUser(UserRole.OWNER, "configowner");

    await request(app)
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ serviceType: ServiceType.BATTERY_REPLACEMENT, displayName: "Battery Replacement", baseFare: 30 });

    const beforeRes = await request(app)
      .get("/api/v1/pricing/config")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const before = beforeRes.body.data;

    const newFuelPrice = before.currentFuelPrice + 1;

    const updateRes = await request(app)
      .post("/api/v1/pricing/config")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ currentFuelPrice: newFuelPrice });

    expect(updateRes.status).toBe(201);
    expect(updateRes.body.data.version).toBe(before.version + 1);
    expect(updateRes.body.data.currentFuelPrice).toBe(newFuelPrice);

    // The old version is preserved (deactivated, not deleted) — this is the whole
    // point of versioning: historical fare calculations stay explainable.
    const oldVersionDoc = await PricingConfigModel.findById(before._id);
    expect(oldVersionDoc?.isActive).toBe(false);
    expect(oldVersionDoc?.effectiveTo).toBeDefined();

    // Cache invalidation check: without it, this would silently return the fuel price
    // from before the update for up to 24h.
    const estimateRes = await request(app)
      .post("/api/v1/pricing/estimate")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        serviceType: ServiceType.BATTERY_REPLACEMENT,
        pickupLocation: PICKUP,
        destinationLocation: DESTINATION,
      });

    const expectedDistanceKm = await expectedDistanceKmFor(PICKUP, DESTINATION);
    const fuelPriceFactor = estimateRes.body.data.factors.find((f: { name: string }) => f.name === "fuelPrice");

    expect(fuelPriceFactor.amount).toBeCloseTo(
      expectedDistanceKm * before.fuelConsumptionPerKm * newFuelPrice,
      1
    );
  });
});
