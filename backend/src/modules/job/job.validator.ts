import { z } from "zod";
import { JobStatus } from "../../constants/job.enum";
import { ServiceType } from "../../constants/service.enum";
import { geoPointSchema } from "../../utils/geo";

const jobLocationSchema = z.object({
  geo: geoPointSchema,
  address: z.string().min(1, "Address is required"),
});

// No companyId — Gap #14 resolution (GAP-REPORT.md). A Customer has no
// legitimate way to obtain one (no company-discovery endpoint exists, and
// the public company lookup deliberately never returns _id), and the
// product design never shows a company concept in the booking flow.
// JobService.create() resolves the platform's operational company
// server-side instead (DEFAULT_COMPANY_CODE).
export const createJobSchema = z.object({
  serviceType: z.enum(Object.values(ServiceType) as [ServiceType, ...ServiceType[]]),
  pickupLocation: jobLocationSchema,
  destinationLocation: jobLocationSchema,
});

// PENDING, ACCEPTED and EXPIRED are deliberately excluded as manual targets:
// ACCEPTED only ever happens through the atomic POST /:id/accept path (going through
// here would bypass the race-safety check and leave driverId/vehicleId unset), and
// PENDING/EXPIRED are system-set, never a status a client requests directly.
const manualTargetStatuses = [
  JobStatus.EN_ROUTE,
  JobStatus.ARRIVED,
  JobStatus.STARTED,
  JobStatus.COMPLETED,
  JobStatus.CANCELLED,
] as const;

export const updateJobStatusSchema = z
  .object({
    status: z.enum(manualTargetStatuses),
    cancellationReason: z.string().min(1).optional(),
  })
  .refine((data) => data.status !== JobStatus.CANCELLED || Boolean(data.cancellationReason), {
    message: "cancellationReason is required when status is CANCELLED",
    path: ["cancellationReason"],
  });

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobStatusInput = z.infer<typeof updateJobStatusSchema>;
