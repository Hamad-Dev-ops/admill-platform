import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";
import { env } from "../config/env";

/**
 * §20 Security Best Practices calls for rate limiting specifically on auth endpoints
 * to blunt brute-force/credential-stuffing. Skipped entirely in test env so the
 * integration suite (many rapid register/login calls) doesn't trip it.
 *
 * Keyed per-account (by email), not per-IP: several people testing from behind the
 * same NAT/tunnel (e.g. a shared ngrok endpoint, or the same office/home network)
 * would otherwise share one lockout bucket — one person's failed attempts locking
 * out everyone else. POST /auth/refresh has no email in its body (just a
 * refreshToken), so it falls back to per-IP for that one case only.
 */
function authRateLimitKey(req: Request): string {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : undefined;
  return email || ipKeyGenerator(req.ip ?? "unknown");
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authRateLimitKey,
  skip: () => env.NODE_ENV === "test",
  message: { success: false, message: "Too many attempts, please try again later" },
});

/**
 * Milestone 11 (§23 Hardening): job creation runs the 2dsphere nearby-driver query
 * and the full pricing engine on every call, and is customer-facing (not behind
 * approval like driver/vehicle writes) — an abuse/spam throttle, not a brute-force
 * one, so a much higher limit than authRateLimiter's.
 */
export const jobCreationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: { success: false, message: "Too many job requests, please try again later" },
});
