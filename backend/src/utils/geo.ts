import { z } from "zod";
import { IGeoPoint } from "../interfaces/geo.interface";

// Shared Zod sub-schema (§11) so every validator that needs a GeoJSON point (job
// pickup/destination, pricing estimate, future driver/customer location) validates
// the same shape once, here, instead of duplicating it.
export const geoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

// Shared "GPS ping" shape — a location plus optional device-reported metadata. Used by
// both the REST self-service location update (modules/driver) and the Socket.IO
// driver:location:update handler (modules/tracking), so the two ingestion paths
// validate identically before either ever reaches TrackingService (Milestone 7,
// architecture decision: one shared business path, not duplicated per-transport logic).
export const driverPositionUpdateSchema = z.object({
  location: geoPointSchema,
  speed: z.number().nonnegative().optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().nonnegative().optional(),
  timestamp: z.coerce.date().optional(),
});

export type DriverPositionUpdateInput = z.infer<typeof driverPositionUpdateSchema>;

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Straight-line distance — no routing API in play yet (see DistanceProvider). Good
// enough for a fare estimate; genuinely wrong for turn-by-turn navigation.
export function haversineDistanceKm(a: IGeoPoint, b: IGeoPoint): number {
  const [lon1, lat1] = a.coordinates;
  const [lon2, lat2] = b.coordinates;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * sinDLon * sinDLon;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
