import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { DeviceTokenService } from "./deviceToken.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user;
}

export const DeviceTokenController = {
  async register(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const deviceToken = await DeviceTokenService.register(user.id, req.body.fcmToken, req.body.platform);
    res.status(201).json(ApiResponse.success(deviceToken, "Device token registered"));
  },
};
