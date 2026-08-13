import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { verifyAccessToken } from "../utils/jwt";

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "Missing or invalid authorization header");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new AppError(401, "Invalid or expired access token");
  }
}
