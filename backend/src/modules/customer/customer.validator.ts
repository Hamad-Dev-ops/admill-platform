import { z } from "zod";

export const registerCustomerSchema = z.object({
  nationalId: z.string().min(1),
  address: z.string().min(1).optional(),
});

export const updateCustomerSchema = z.object({
  nationalId: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
});

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
