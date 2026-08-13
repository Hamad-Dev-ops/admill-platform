import { z } from 'zod';

// Mirrors registerDriverSchema in the backend's driver.validator.ts exactly
// (verified directly against source during the Phase 3 preflight).
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const driverRegistrationSchema = z.object({
  companyCode: z.string().min(1, 'Company code is required'),
  nationalId: z.string().min(1, 'National ID is required'),
  emiratesId: z.string().min(1, 'Emirates ID is required'),
  emiratesIdExpiry: isoDateString,
  drivingLicenseNumber: z.string().min(1, 'Driving license number is required'),
  drivingLicenseExpiry: isoDateString,
});

export type DriverRegistrationValues = z.infer<typeof driverRegistrationSchema>;
