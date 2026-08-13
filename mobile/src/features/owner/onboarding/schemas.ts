import { z } from 'zod';

// Mirrors createCompanySchema in the backend's company.validator.ts exactly.
// serviceAreas is collected as one comma-separated text field in the form
// (no precedent anywhere in this app for a free-text array input) and split
// into a real string[] in the screen's submit handler before the API call —
// kept as a single validated string here so react-hook-form/zodResolver
// stays a plain string-keyed form, same shape as every other onboarding form.
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const companySetupSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().min(6, 'Enter a valid phone number'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  tradeLicenseNumber: z.string().min(1, 'Trade license number is required'),
  tradeLicenseExpiry: isoDateString,
  serviceAreas: z.string().min(1, 'Enter at least one service area'),
});

export type CompanySetupValues = z.infer<typeof companySetupSchema>;
