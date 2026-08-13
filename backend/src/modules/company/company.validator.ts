import { z } from "zod";

export const createCompanySchema = z.object({
  companyName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  logo: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  tradeLicenseNumber: z.string().min(1),
  tradeLicenseExpiry: z.coerce.date(),
  serviceAreas: z.array(z.string().min(1)).min(1),
});

export const updateCompanySchema = createCompanySchema.partial();

export const updateCompanySettingsSchema = z.object({
  operatingHours: z
    .object({
      open: z.string(),
      close: z.string(),
    })
    .partial()
    .optional(),
  defaultServiceRadiusKm: z.number().positive().optional(),
  notificationPreferences: z
    .object({
      email: z.boolean(),
      sms: z.boolean(),
      push: z.boolean(),
    })
    .partial()
    .optional(),
  invoiceBranding: z
    .object({
      logoUrl: z.string(),
      invoicePrefix: z.string(),
    })
    .partial()
    .optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;
