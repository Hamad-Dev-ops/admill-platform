import { z } from "zod";
import { ServiceType } from "../../constants/service.enum";

const serviceTypeValues = Object.values(ServiceType) as [ServiceType, ...ServiceType[]];

export const createServiceSchema = z.object({
  serviceType: z.enum(serviceTypeValues),
  displayName: z.string().min(1),
  description: z.string().optional(),
  baseFare: z.number().positive(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
