import { z } from "zod";
import { DriverStatus } from "../../constants/driver.enum";

export const registerDriverSchema = z.object({
  companyCode: z.string().min(1),
  nationalId: z.string().min(1),
  emiratesId: z.string().min(1),
  emiratesIdExpiry: z.coerce.date(),
  drivingLicenseNumber: z.string().min(1),
  drivingLicenseExpiry: z.coerce.date(),
});

export const updateDriverSchema = z.object({
  nationalId: z.string().min(1).optional(),
  emiratesId: z.string().min(1).optional(),
  emiratesIdExpiry: z.coerce.date().optional(),
  drivingLicenseNumber: z.string().min(1).optional(),
  drivingLicenseExpiry: z.coerce.date().optional(),
  profileImage: z.string().optional(),
});

export const rejectDriverSchema = z.object({
  reason: z.string().min(1).optional(),
});

// Self-service subset only — ON_JOB is set by JobService on accept/complete, not by
// the driver directly; ON_LEAVE/SUSPENDED are owner/HR-controlled, not self-service.
export const updateDriverStatusSchema = z.object({
  status: z.enum([DriverStatus.AVAILABLE, DriverStatus.OFFLINE, DriverStatus.ON_BREAK]),
});

export type RegisterDriverInput = z.infer<typeof registerDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type RejectDriverInput = z.infer<typeof rejectDriverSchema>;
export type UpdateDriverStatusInput = z.infer<typeof updateDriverStatusSchema>;
