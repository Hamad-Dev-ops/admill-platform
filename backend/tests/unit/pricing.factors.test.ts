import { describe, expect, it } from "vitest";
import { ServiceType } from "../../src/constants/service.enum";
import { activeFactors, runFactors } from "../../src/modules/pricing/pricing.service";
import { IPricingContext, IPricingFactor } from "../../src/modules/pricing/factors/types";

// Pure, deterministic tests — no DB, no network. This is exactly what makes the
// factor architecture's central promise real: every factor is a synchronous function
// of a fully-resolved context, so totals can be hand-calculated and checked exactly.

const PEAK_WINDOWS = [
  { startHour: 7, endHour: 10 },
  { startHour: 17, endHour: 20 },
];

function offPeakTimestamp(): Date {
  // 10:00 UTC = 14:00 UAE (UTC+4) — outside both configured peak windows.
  return new Date(Date.UTC(2026, 0, 1, 10, 0, 0));
}

function peakTimestamp(): Date {
  // 04:00 UTC = 08:00 UAE — inside the 7-10 morning peak window.
  return new Date(Date.UTC(2026, 0, 1, 4, 0, 0));
}

function buildContext(overrides: Partial<IPricingContext>): IPricingContext {
  return {
    serviceType: ServiceType.CAR_TOWING,
    distanceKm: 10,
    durationMinutes: 15,
    timestamp: offPeakTimestamp(),
    baseFare: 50,
    currentFuelPrice: 2.5,
    fuelConsumptionPerKm: 0.12,
    perKmRate: 2,
    peakHourWindows: PEAK_WINDOWS,
    peakHourSurcharge: 15,
    demandRatio: 0,
    maxDemandSurcharge: 30,
    weatherCondition: "CLEAR",
    ...overrides,
  };
}

describe("Pricing factors (Milestone 5) — manual-calculation verification", () => {
  it("computes an off-peak, no-demand, clear-weather estimate correctly", () => {
    // base 50 + distance(10km*2) 20 + fuel(10*0.12*2.5) 3 + weather 0 + time 0 + demand 0 = 73
    const breakdown = runFactors(activeFactors, buildContext({}));

    expect(breakdown.total).toBe(73);
    expect(breakdown.factors.find((f) => f.name === "baseService")?.amount).toBe(50);
    expect(breakdown.factors.find((f) => f.name === "distance")?.amount).toBe(20);
    expect(breakdown.factors.find((f) => f.name === "fuelPrice")?.amount).toBe(3);
    expect(breakdown.factors.find((f) => f.name === "time")?.amount).toBe(0);
    expect(breakdown.factors.find((f) => f.name === "demand")?.amount).toBe(0);
  });

  it("applies the peak-hour surcharge only inside a configured window, and demand independently", () => {
    // Same inputs as above but during peak hours with 50% demand pressure:
    // 50 + 20 + 3 + weather 0 + time 15 + demand(0.5*30) 15 = 103
    const breakdown = runFactors(
      activeFactors,
      buildContext({ timestamp: peakTimestamp(), demandRatio: 0.5 })
    );

    expect(breakdown.total).toBe(103);
    expect(breakdown.factors.find((f) => f.name === "time")?.amount).toBe(15);
    expect(breakdown.factors.find((f) => f.name === "demand")?.amount).toBe(15);
  });

  it("never applies the peak surcharge just outside the window boundary", () => {
    // 10:59 UTC = ~14:59 UAE — still off-peak. 06:00 UTC = 10:00 UAE — window end is
    // exclusive, so exactly 10:00 must NOT count as peak.
    const atWindowEnd = buildContext({ timestamp: new Date(Date.UTC(2026, 0, 1, 6, 0, 0)) });
    const breakdown = runFactors(activeFactors, atWindowEnd);

    expect(breakdown.factors.find((f) => f.name === "time")?.amount).toBe(0);
  });

  it("produces a different, independently-verifiable total for a second service", () => {
    // 20 + distance(5*2) 10 + fuel(5*0.12*2.5) 1.5 + weather 0 + time(peak) 15 + demand(0.3*30) 9 = 55.5
    const breakdown = runFactors(
      activeFactors,
      buildContext({
        serviceType: ServiceType.JUMP_START,
        baseFare: 20,
        distanceKm: 5,
        timestamp: peakTimestamp(),
        demandRatio: 0.3,
      })
    );

    expect(breakdown.total).toBe(55.5);
  });

  it("applies the exact weather surcharge for each condition", () => {
    const clear = runFactors(activeFactors, buildContext({ weatherCondition: "CLEAR" }));
    const rain = runFactors(activeFactors, buildContext({ weatherCondition: "RAIN" }));
    const extreme = runFactors(activeFactors, buildContext({ weatherCondition: "EXTREME" }));
    const storm = runFactors(activeFactors, buildContext({ weatherCondition: "STORM" }));

    expect(clear.total).toBe(73);
    expect(rain.total).toBe(83);
    expect(extreme.total).toBe(93);
    expect(storm.total).toBe(98);
  });

  it("lets a new factor be added with zero changes to the aggregation logic itself", () => {
    // This is the actual acceptance test for Decision #6/the Strategy pattern promise:
    // runFactors is the exact function PricingService uses internally, unmodified.
    const dummyFactor: IPricingFactor = {
      name: "dummy",
      calculate: () => ({ name: "dummy", amount: 7, description: "temporary test factor" }),
    };

    const withoutDummy = runFactors(activeFactors, buildContext({}));
    const withDummy = runFactors([...activeFactors, dummyFactor], buildContext({}));

    expect(withDummy.total).toBe(withoutDummy.total + 7);
    expect(withDummy.factors).toHaveLength(withoutDummy.factors.length + 1);
  });
});
