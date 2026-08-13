import { z } from 'zod';

// Mirrors updateCompanySettingsSchema in the backend's company validator —
// all optional/partial, matching the PATCH endpoint's own contract.
export const operatingHoursSchema = z.object({
  open: z.string().min(1, 'Required'),
  close: z.string().min(1, 'Required'),
});

export const companyProfileSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().min(6, 'Enter a valid phone number'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
});

export type CompanyProfileValues = z.infer<typeof companyProfileSchema>;

export const pricingFormSchema = z.object({
  currentFuelPrice: z.coerce.number().positive('Must be greater than 0'),
  fuelConsumptionPerKm: z.coerce.number().positive('Must be greater than 0'),
  perKmRate: z.coerce.number().positive('Must be greater than 0'),
  peakHourSurcharge: z.coerce.number().min(0),
  lowSupplyThreshold: z.coerce.number().min(0),
  maxDemandSurcharge: z.coerce.number().min(0),
});

export type PricingFormValues = z.infer<typeof pricingFormSchema>;
