import { IGeoPoint } from "../../../interfaces/geo.interface";
import { haversineDistanceKm } from "../../../utils/geo";
import { IDistanceProvider, IRouteResult } from "./distance.provider.interface";

// Documented estimate, not a measurement — this only runs when real routing is
// unavailable, so an approximate ETA beats none at all.
const FALLBACK_AVERAGE_SPEED_KMH = 40;

export class HaversineDistanceProvider implements IDistanceProvider {
  async getRoute(origin: IGeoPoint, destination: IGeoPoint): Promise<IRouteResult> {
    const distanceKm = haversineDistanceKm(origin, destination);
    const durationMinutes = (distanceKm / FALLBACK_AVERAGE_SPEED_KMH) * 60;

    return { distanceKm, durationMinutes };
  }
}
