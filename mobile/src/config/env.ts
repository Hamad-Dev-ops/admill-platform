import Config from 'react-native-config';
import { z } from 'zod';

const envSchema = z.object({
  API_BASE_URL: z.string().url(),
  SOCKET_URL: z.string().url(),
});

// Fails fast at startup if .env is missing/misconfigured rather than
// surfacing a confusing network error deep inside the first API call.
export const env = envSchema.parse({
  API_BASE_URL: Config.API_BASE_URL,
  SOCKET_URL: Config.SOCKET_URL,
});
