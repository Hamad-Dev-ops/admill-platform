import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigFuelPriceProvider,
  invalidateFuelPriceCache,
} from "../../src/infrastructure/providers/fuelPrice/config.provider";
import { PricingConfigRepository } from "../../src/repositories/pricingConfig.repository";

const CURRENT_CONFIG = {
  _id: new Types.ObjectId(),
  version: 1,
  currentFuelPrice: 2.5,
  fuelConsumptionPerKm: 0.12,
  perKmRate: 2,
  peakHourWindows: [],
  peakHourSurcharge: 15,
  lowSupplyThreshold: 5,
  maxDemandSurcharge: 30,
  surgeEnabled: false,
};

describe("ConfigFuelPriceProvider (hybrid strategy)", () => {
  beforeEach(async () => {
    // Shared in-memory cache singleton — must be cleared between tests within this
    // file, or an earlier test's cached price silently short-circuits a later one.
    await invalidateFuelPriceCache();
    vi.spyOn(PricingConfigRepository, "findActiveOrCreateDefault").mockResolvedValue(CURRENT_CONFIG as never);
    vi.spyOn(PricingConfigRepository, "createNewVersionFrom").mockResolvedValue(CURRENT_CONFIG as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the stored value and never touches the external source when none is configured", async () => {
    const externalFetch = vi.fn();
    const provider = new ConfigFuelPriceProvider(externalFetch, false);

    const price = await provider.getCurrentFuelPrice();

    expect(price).toBe(2.5);
    expect(externalFetch).not.toHaveBeenCalled();
    expect(PricingConfigRepository.createNewVersionFrom).not.toHaveBeenCalled();
  });

  it("persists a new version when the external source returns a genuinely different price", async () => {
    const externalFetch = vi.fn().mockResolvedValue(2.75);
    const provider = new ConfigFuelPriceProvider(externalFetch, true);

    const price = await provider.getCurrentFuelPrice();

    expect(price).toBe(2.75);
    expect(PricingConfigRepository.createNewVersionFrom).toHaveBeenCalledWith(CURRENT_CONFIG, {
      currentFuelPrice: 2.75,
    });
  });

  it("does not create a no-op version when the external source returns the same price already stored", async () => {
    const externalFetch = vi.fn().mockResolvedValue(2.5);
    const provider = new ConfigFuelPriceProvider(externalFetch, true);

    const price = await provider.getCurrentFuelPrice();

    expect(price).toBe(2.5);
    expect(PricingConfigRepository.createNewVersionFrom).not.toHaveBeenCalled();
  });

  it("falls back to the last stored value, without throwing, when the external source fails", async () => {
    const externalFetch = vi.fn().mockRejectedValue(new Error("external source down"));
    const provider = new ConfigFuelPriceProvider(externalFetch, true);

    await expect(provider.getCurrentFuelPrice()).resolves.toBe(2.5);
    expect(PricingConfigRepository.createNewVersionFrom).not.toHaveBeenCalled();
  });

  it("caches the result so a second call doesn't re-query the repository", async () => {
    const externalFetch = vi.fn();
    const provider = new ConfigFuelPriceProvider(externalFetch, false);

    await provider.getCurrentFuelPrice();
    await provider.getCurrentFuelPrice();

    expect(PricingConfigRepository.findActiveOrCreateDefault).toHaveBeenCalledTimes(1);
  });
});
