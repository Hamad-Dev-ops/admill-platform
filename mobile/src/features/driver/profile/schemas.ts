import { z } from 'zod';

// Mirrors updateDriverSchema in the backend's driver.validator.ts (verified
// directly against source) — same fields as registration minus companyCode,
// since a driver can't change which company they belong to via this form.
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const driverEditProfileSchema = z.object({
  nationalId: z.string().min(1, 'National ID is required'),
  emiratesId: z.string().min(1, 'Emirates ID is required'),
  emiratesIdExpiry: isoDateString,
  drivingLicenseNumber: z.string().min(1, 'Driving license number is required'),
  drivingLicenseExpiry: isoDateString,
});

export type DriverEditProfileValues = z.infer<typeof driverEditProfileSchema>;
