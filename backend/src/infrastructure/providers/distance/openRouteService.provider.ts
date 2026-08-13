import { env } from "../../../config/env";
import { IGeoPoint } from "../../../interfaces/geo.interface";
import { logger } from "../../../utils/logger";
import { IDistanceProvider, IRouteResult } from "./distance.provider.interface";
import { HaversineDistanceProvider } from "./haversine.provider";

interface IDirectionsResponse {
  routes?: { summary?: { distance: number; duration: number } }[];
}

async function fetchFromOpenRouteService(origin: IGeoPoint, destination: IGeoPoint): Promise<IRouteResult> {
  const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: {
      Authorization: env.OPENROUTESERVICE_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coordinates: [origin.coordinates, destination.coordinates] }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouteService returned ${res.status}`);
  }

  const data = (await res.json()) as IDirectionsResponse;
  const summary = data.routes?.[0]?.summary;

  if (!summary) {
    throw new Error("OpenRouteService response missing route summary");
  }

  return {
    distanceKm: summary.distance / 1000,
    durationMinutes: summary.duration / 60,
  };
}

/**
 * Real road distance/ETA, primary implementation. Falls back to Haversine (with an
 * estimated ETA) whenever the API key isn't configured at all, or whenever the real
 * call fails for any reason — a routing lookup must never fail the fare estimate.
 *
 * Both the fallback and the primary fetch are constructor-injected so this fallback
 * behavior is deterministically unit-testable without a real network call or key.
 */
export class OpenRouteServiceProvider implements IDistanceProvider {
  constructor(
    private readonly fallback: IDistanceProvider = new HaversineDistanceProvider(),
    private readonly primaryFetch: typeof fetchFromOpenRouteService = fetchFromOpenRouteService,
    // Injectable separately from the env check itself — otherwise a test environment
    // with no real key set could never exercise the "key configured" branch at all.
    private readonly hasApiKey: boolean = Boolean(env.OPENROUTESERVICE_API_KEY)
  ) {}

  async getRoute(origin: IGeoPoint, destination: IGeoPoint): Promise<IRouteResult> {
    if (!this.hasApiKey) {
      return this.fallback.getRoute(origin, destination);
    }

    try {
      return await this.primaryFetch(origin, destination);
    } catch (err) {
      logger.warn({ err }, "OpenRouteService request failed, falling back to Haversine");
      return this.fallback.getRoute(origin, destination);
    }
  }
}

export const distanceProvider: IDistanceProvider = new OpenRouteServiceProvider();
