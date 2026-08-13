import { env } from '../config/env';
import type { GeoPoint } from '../types/api';

// Google's Routes API (routes.googleapis.com), not the legacy Directions
// API — Google's own error response for this project explicitly steered
// toward Routes API when the legacy one was tested and found not enabled
// (GAP-REPORT.md's Phase 5 Polyline note). Needs Routes API enabled on the
// same Cloud project GOOGLE_MAPS_API_KEY belongs to, separately from "Maps
// SDK for Android" — see .env.example.
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const REQUEST_TIMEOUT_MS = 8000;

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

interface RoutesApiResponse {
  routes?: Array<{ polyline?: { encodedPolyline?: string } }>;
}

// Google's standard polyline encoding algorithm (the format Routes API
// returns by default) — https://developers.google.com/maps/documentation/utilities/polylinealgorithm.
// A well-known, ~20-line algorithm; not worth a dependency for
// (architecture-baseline.md: no unnecessary dependencies). The bitwise ops
// below are inherent to this exact algorithm (varint + zigzag decoding),
// not a style choice — disabling no-bitwise scoped to just this function.
/* eslint-disable no-bitwise */
function decodePolyline(encoded: string): RouteCoordinate[] {
  const coordinates: RouteCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
}
/* eslint-enable no-bitwise */

// Never throws — every failure mode (no key configured, Routes API not
// enabled/authorized, network error, timeout, an unexpected response shape)
// resolves to null so callers fall back to the existing markers-only map,
// exactly as it worked before this feature existed. No caching, no retry
// beyond the caller's own React Query default, no state — this function
// does exactly one thing.
export async function getRoute(pickup: GeoPoint, destination: GeoPoint): Promise<RouteCoordinate[] | null> {
  if (!env.GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ROUTES_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: pickup.coordinates[1], longitude: pickup.coordinates[0] } },
        },
        destination: {
          location: { latLng: { latitude: destination.coordinates[1], longitude: destination.coordinates[0] } },
        },
        travelMode: 'DRIVE',
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as RoutesApiResponse;
    const encoded = data.routes?.[0]?.polyline?.encodedPolyline;
    if (!encoded) {
      return null;
    }

    const coordinates = decodePolyline(encoded);
    return coordinates.length > 0 ? coordinates : null;
  } catch {
    // Network error, timeout (AbortError), JSON parse failure — all
    // collapse to the same safe outcome: no route, markers-only.
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
