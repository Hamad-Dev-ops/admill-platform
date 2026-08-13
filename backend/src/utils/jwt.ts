import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../constants/role.enum";

export interface IAccessTokenPayload {
  sub: string;
  role: UserRole;
}

export function signAccessToken(payload: IAccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): IAccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as IAccessTokenPayload;
}

const DURATION_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);

  if (!match) {
    throw new Error(`Invalid duration format: "${duration}" (expected e.g. "30d", "15m")`);
  }

  return Number(match[1]) * DURATION_UNIT_MS[match[2]];
}

/**
 * Refresh tokens are opaque random strings, not JWTs — they don't need to be
 * self-describing, only unguessable. Hashed with HMAC-SHA256 (keyed by
 * JWT_REFRESH_SECRET) before storage, so a DB read alone can't produce a usable token.
 */
export function generateRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRY));

  return { token, tokenHash, expiresAt };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");
}
