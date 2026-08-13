import { Request, Response } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { ServiceService } from "./service.service";

export const ServiceController = {
  async create(req: Request, res: Response): Promise<void> {
    const service = await ServiceService.create(req.body);
    res.status(201).json(ApiResponse.success(service, "Service created successfully"));
  },

  async list(_req: Request, res: Response): Promise<void> {
    const services = await ServiceService.listAll();
    res.status(200).json(ApiResponse.success(services));
  },
};
