import Config from 'react-native-config';
import { z } from 'zod';

const envSchema = z.object({
  API_BASE_URL: z.string().url(),
  SOCKET_URL: z.string().url(),
  // Optional, unlike the two above — the app must still boot and function
  // normally (minus route polylines, src/utils/directions.ts) if this is
  // unset. Also used natively (AndroidManifest.xml meta-data, unaffected by
  // this) — this is what makes the same value additionally readable here in
  // JS, for the Directions/Routes API call (Phase 5 Polyline).
  GOOGLE_MAPS_API_KEY: z.string().optional(),
});

// Fails fast at startup if .env is missing/misconfigured rather than
// surfacing a confusing network error deep inside the first API call.
export const env = envSchema.parse({
  API_BASE_URL: Config.API_BASE_URL,
  SOCKET_URL: Config.SOCKET_URL,
  GOOGLE_MAPS_API_KEY: Config.GOOGLE_MAPS_API_KEY,
});
