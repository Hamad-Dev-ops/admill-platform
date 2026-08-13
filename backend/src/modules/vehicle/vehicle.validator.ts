import { z } from "zod";
import { ServiceType } from "../../constants/service.enum";
import { VehicleType } from "../../constants/vehicle.enum";

const vehicleTypeValues = Object.values(VehicleType) as [VehicleType, ...VehicleType[]];
const serviceTypeValues = Object.values(ServiceType) as [ServiceType, ...ServiceType[]];

export const createVehicleSchema = z.object({
  plateNumber: z.string().min(1),
  registrationNumber: z.string().min(1),
  chassisNumber: z.string().min(1),
  vehicleType: z.enum(vehicleTypeValues),
  recoveryType: z.array(z.enum(serviceTypeValues)).min(1),
  insurancePolicyNumber: z.string().min(1),
  insuranceExpiry: z.coerce.date(),
  registrationExpiry: z.coerce.date(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const assignDriverSchema = z.object({
  driverId: z.string().min(1),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
