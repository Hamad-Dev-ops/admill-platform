import { Request, Response } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PricingService } from "./pricing.service";
import { PricingConfigService } from "./pricingConfig.service";

export const PricingController = {
  async estimate(req: Request, res: Response): Promise<void> {
    const { serviceType, pickupLocation, destinationLocation } = req.body;
    const breakdown = await PricingService.calculateFare(serviceType, pickupLocation, destinationLocation);
    res.status(200).json(ApiResponse.success(breakdown));
  },

  async getConfig(_req: Request, res: Response): Promise<void> {
    const config = await PricingConfigService.getActive();
    res.status(200).json(ApiResponse.success(config));
  },

  async updateConfig(req: Request, res: Response): Promise<void> {
    const config = await PricingConfigService.createNewVersion(req.body);
    res.status(201).json(ApiResponse.success(config, "New pricing config version created"));
  },
};
