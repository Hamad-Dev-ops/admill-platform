import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { CustomerService } from "./customer.service";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user.id;
}

export const CustomerController = {
  async register(req: Request, res: Response): Promise<void> {
    const customer = await CustomerService.register(requireUserId(req), req.body);
    res.status(201).json(ApiResponse.success(customer, "Customer registered successfully"));
  },

  async getMe(req: Request, res: Response): Promise<void> {
    const customer = await CustomerService.getMyProfile(requireUserId(req));
    res.status(200).json(ApiResponse.success(customer));
  },

  async updateMe(req: Request, res: Response): Promise<void> {
    const customer = await CustomerService.updateMyProfile(requireUserId(req), req.body);
    res.status(200).json(ApiResponse.success(customer, "Customer profile updated successfully"));
  },
};
