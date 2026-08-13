import { Request, Response } from "express";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { AuthService } from "./auth.service";

const REFRESH_COOKIE_NAME = "refreshToken";

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME);
}

function extractRefreshToken(req: Request): string {
  const token = req.body.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    throw new AppError(401, "Refresh token is required");
  }

  return token;
}

export const AuthController = {
  async register(req: Request, res: Response): Promise<void> {
    const result = await AuthService.register(req.body, req.headers["user-agent"]);
    setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    res.status(201).json(ApiResponse.success(result, "Registered successfully"));
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await AuthService.login(req.body, req.headers["user-agent"]);
    setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    res.status(200).json(ApiResponse.success(result, "Logged in successfully"));
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const presentedToken = extractRefreshToken(req);
    const result = await AuthService.refresh(presentedToken, req.headers["user-agent"]);
    setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    res.status(200).json(ApiResponse.success(result, "Token refreshed successfully"));
  },

  async logout(req: Request, res: Response): Promise<void> {
    const token = req.body.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];

    if (token) {
      await AuthService.logout(token);
    }

    clearRefreshCookie(res);
    res.status(200).json(ApiResponse.success(null, "Logged out successfully"));
  },

  async logoutAll(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError(401, "Authentication required");
    }

    await AuthService.logoutAll(req.user.id);
    clearRefreshCookie(res);
    res.status(200).json(ApiResponse.success(null, "Logged out of all devices successfully"));
  },
};
