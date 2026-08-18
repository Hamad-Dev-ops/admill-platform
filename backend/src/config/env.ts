import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

/**
 * FCM is still validated as optional — nothing consumes it until Milestone 8 (push
 * notifications). Cloudinary was optional through Milestone 2 for the same reason but
 * is now required: Milestone 3 (documents) actually uploads files with it.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  FRONTEND_URL: z.string().min(1, "FRONTEND_URL is required"),

  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),

  OPENWEATHER_API_KEY: z.string().min(1, "OPENWEATHER_API_KEY is required"),

  // Both optional by design — graceful degradation without them (Haversine fallback,
  // stored-config fallback) is the entire point, not a temporary bootstrapping state.
  OPENROUTESERVICE_API_KEY: z.string().optional(),
  FUEL_PRICE_EXTERNAL_API_URL: z.string().optional(),

  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),

  // Override pino level for QA/debug (e.g. LOG_LEVEL=debug to see every GPS ping).
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
