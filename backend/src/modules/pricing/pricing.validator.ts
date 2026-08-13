import { z } from "zod";
import { ServiceType } from "../../constants/service.enum";
import { geoPointSchema } from "../../utils/geo";

const serviceTypeValues = Object.values(ServiceType) as [ServiceType, ...ServiceType[]];

export const estimateFareSchema = z.object({
  serviceType: z.enum(serviceTypeValues),
  pickupLocation: geoPointSchema,
  destinationLocation: geoPointSchema,
});

const peakHourWindowSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
});

export const updatePricingConfigSchema = z.object({
  currentFuelPrice: z.number().positive().optional(),
  fuelConsumptionPerKm: z.number().positive().optional(),
  perKmRate: z.number().positive().optional(),
  peakHourWindows: z.array(peakHourWindowSchema).optional(),
  peakHourSurcharge: z.number().min(0).optional(),
  lowSupplyThreshold: z.number().min(0).optional(),
  maxDemandSurcharge: z.number().min(0).optional(),
  surgeEnabled: z.boolean().optional(),
});

export type EstimateFareInput = z.infer<typeof estimateFareSchema>;
export type UpdatePricingConfigInput = z.infer<typeof updatePricingConfigSchema>;
