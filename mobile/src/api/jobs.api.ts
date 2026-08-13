import { apiClient } from './client';
import type { ApiSuccess, PaginationMeta } from '../types/api';
import type { JobStatus, ServiceType } from '../types/enums';
import type { Job, JobLocation } from '../types/entities';

// frontend-docs/API-CONTRACT.md §Job + JOB-LIFECYCLE.md. Result set is
// scoped server-side by role — for OWNER this is always their own company's
// jobs, no companyId param needed/accepted.

// CUSTOMER-only. No companyId — GAP-REPORT.md gap #14, RESOLVED. The
// backend resolves the platform's operational company itself server-side
// (DEFAULT_COMPANY_CODE); the Customer app has no company concept at all,
// matching the design exactly.
export interface CreateJobPayload {
  serviceType: ServiceType;
  pickupLocation: JobLocation;
  destinationLocation: JobLocation;
}

export async function createJob(payload: CreateJobPayload): Promise<Job> {
  const { data } = await apiClient.post<ApiSuccess<Job>>('/jobs', payload);
  return data.data;
}

export async function listJobs(params?: {
  page?: number;
  limit?: number;
  status?: JobStatus;
}): Promise<{ data: Job[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiSuccess<Job[]>>('/jobs', { params });
  return { data: data.data, meta: data.meta! };
}

export async function getJobById(jobId: string): Promise<Job> {
  const { data } = await apiClient.get<ApiSuccess<Job>>(`/jobs/${jobId}`);
  return data.data;
}

// Cancellation is available to whoever can view the job (Customer/Driver/
// Owner) — one shared function reused across every role's UI, not a
// per-role duplicate (JOB-LIFECYCLE.md).
export async function cancelJob(jobId: string, cancellationReason: string): Promise<Job> {
  const { data } = await apiClient.patch<ApiSuccess<Job>>(`/jobs/${jobId}/status`, {
    status: 'CANCELLED',
    cancellationReason,
  });
  return data.data;
}

// Driver-only, race-safe on the backend (atomic findOneAndUpdate — see
// JOB-LIFECYCLE.md/SOCKET-CONTRACT.md). Callers MUST handle a losing-the-race
// 409 as a real, expected outcome, not an unexpected error — two drivers can
// legitimately both attempt this for the same offer.
export async function acceptJob(jobId: string): Promise<Job> {
  const { data } = await apiClient.post<ApiSuccess<Job>>(`/jobs/${jobId}/accept`);
  return data.data;
}

// Does NOT change the job's status — purely informational on the backend,
// the job stays PENDING for any other offered driver (JOB-LIFECYCLE.md).
export async function rejectJob(jobId: string): Promise<Job> {
  const { data } = await apiClient.post<ApiSuccess<Job>>(`/jobs/${jobId}/reject`);
  return data.data;
}

export type DriverProgressStatus = 'EN_ROUTE' | 'ARRIVED' | 'STARTED' | 'COMPLETED';

// The only 4 transitions a Driver may ever trigger, and only when they're
// the job's assigned driver (job.state-machine.ts / assertStatusChangeAllowed).
export async function progressJobStatus(jobId: string, status: DriverProgressStatus): Promise<Job> {
  const { data } = await apiClient.patch<ApiSuccess<Job>>(`/jobs/${jobId}/status`, { status });
  return data.data;
}

// CUSTOMER-only, job must be COMPLETED and belong to this customer, one
// rating per job (409 on a repeat attempt — job.routes.ts/rating.service.ts,
// re-verified). No tags/categories field exists — body is exactly
// {stars, review?}.
export interface RateJobPayload {
  stars: 1 | 2 | 3 | 4 | 5;
  review?: string;
}

export interface Rating {
  _id: string;
  jobId: string;
  customerId: string;
  driverId: string;
  stars: number;
  review?: string;
}

export async function rateJob(jobId: string, payload: RateJobPayload): Promise<Rating> {
  const { data } = await apiClient.post<ApiSuccess<Rating>>(`/jobs/${jobId}/rating`, payload);
  return data.data;
}
