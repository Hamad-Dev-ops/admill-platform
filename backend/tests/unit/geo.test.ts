import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "../../src/utils/geo";

describe("haversineDistanceKm", () => {
  it("matches the well-known ~111.2km per degree of latitude", () => {
    // Independent check against a known real-world value (not just internal
    // consistency with the pricing tests, which reuse this same function) — one
    // degree of latitude is ~111.2km anywhere on Earth, regardless of longitude.
    const a = { type: "Point" as const, coordinates: [55.0, 25.0] as [number, number] };
    const b = { type: "Point" as const, coordinates: [55.0, 26.0] as [number, number] };

    const distance = haversineDistanceKm(a, b);

    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("returns 0 for identical points", () => {
    const point = { type: "Point" as const, coordinates: [55.27, 25.2] as [number, number] };

    expect(haversineDistanceKm(point, point)).toBe(0);
  });
});
