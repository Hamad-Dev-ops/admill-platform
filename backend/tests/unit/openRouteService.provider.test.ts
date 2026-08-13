import { describe, expect, it, vi } from "vitest";
import { HaversineDistanceProvider } from "../../src/infrastructure/providers/distance/haversine.provider";
import { OpenRouteServiceProvider } from "../../src/infrastructure/providers/distance/openRouteService.provider";
import { IGeoPoint } from "../../src/interfaces/geo.interface";

const ORIGIN: IGeoPoint = { type: "Point", coordinates: [55.27, 25.2] };
const DESTINATION: IGeoPoint = { type: "Point", coordinates: [55.14, 25.08] };

describe("OpenRouteServiceProvider", () => {
  it("uses the fallback directly when no API key is configured, without ever calling the primary fetch", async () => {
    const fallback = new HaversineDistanceProvider();
    const primaryFetch = vi.fn();
    const provider = new OpenRouteServiceProvider(fallback, primaryFetch, false);

    const result = await provider.getRoute(ORIGIN, DESTINATION);
    const expected = await fallback.getRoute(ORIGIN, DESTINATION);

    expect(primaryFetch).not.toHaveBeenCalled();
    expect(result.distanceKm).toBeCloseTo(expected.distanceKm, 5);
  });

  it("returns the primary result when the API key is configured and the call succeeds", async () => {
    const fallback = new HaversineDistanceProvider();
    const primaryFetch = vi.fn().mockResolvedValue({ distanceKm: 12.3, durationMinutes: 18 });
    const provider = new OpenRouteServiceProvider(fallback, primaryFetch, true);

    const result = await provider.getRoute(ORIGIN, DESTINATION);

    expect(primaryFetch).toHaveBeenCalledWith(ORIGIN, DESTINATION);
    expect(result).toEqual({ distanceKm: 12.3, durationMinutes: 18 });
  });

  it("falls back to Haversine when the API key is configured but the real call fails", async () => {
    const fallback = new HaversineDistanceProvider();
    const primaryFetch = vi.fn().mockRejectedValue(new Error("network error"));
    const provider = new OpenRouteServiceProvider(fallback, primaryFetch, true);

    const result = await provider.getRoute(ORIGIN, DESTINATION);
    const expected = await fallback.getRoute(ORIGIN, DESTINATION);

    expect(primaryFetch).toHaveBeenCalled();
    expect(result.distanceKm).toBeCloseTo(expected.distanceKm, 5);
  });
});
