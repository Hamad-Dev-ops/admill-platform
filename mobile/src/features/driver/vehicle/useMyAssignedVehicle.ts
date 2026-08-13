import { useQuery } from '@tanstack/react-query';
import { isForbiddenError, isNotFoundError } from '../../../api/client';
import { getVehicleById } from '../../../api/vehicles.api';
import { listJobs } from '../../../api/jobs.api';
import type { Vehicle } from '../../../types/entities';

// Best-effort workaround for a real gap (frontend-docs/GAP-REPORT.md gap
// #12) — there is no driver-facing "my vehicle" endpoint. Derives the
// vehicle from the driver's own most recent job that has a vehicleId set
// (GET /jobs is already self-scoped), then fetches it via GET /vehicles/:id.
//
// That vehicleId can go stale: if the Owner reassigns the vehicle to a
// different driver after this driver's last job, GET /vehicles/:id's own
// authorization (vehicle.service.ts's assertVehicleAccess, checked directly
// — not a mobile-side assumption) correctly 403s, since the driver is no
// longer the vehicle's current assignedDriver. That is a legitimate,
// expected outcome of a real ownership change, not a bug or an absence of
// data — it must be distinguishable from "you have no vehicle" (a driver
// with no job history yet) and from a genuine 404 (the vehicleId points at
// something that no longer exists — vehicles are never deleted anywhere in
// this app today, so this is currently unreachable in practice, but handled
// distinctly rather than assumed impossible) and from a real network/server
// failure (retryable, unlike the other three).
export type AssignedVehicleStatus =
  | { kind: 'loading' }
  | { kind: 'no-vehicle'; reason: 'no-job-history' | 'vehicle-not-found' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; retry: () => void }
  | { kind: 'ready'; vehicle: Vehicle };

export function useMyAssignedVehicle(): AssignedVehicleStatus {
  const jobsQuery = useQuery({
    queryKey: ['jobs', 'recent-for-vehicle-lookup'],
    queryFn: () => listJobs({ limit: 20 }),
  });

  const vehicleId = jobsQuery.data?.data.find((job) => job.vehicleId)?.vehicleId;

  const vehicleQuery = useQuery({
    queryKey: ['vehicles', vehicleId],
    queryFn: () => getVehicleById(vehicleId!),
    enabled: !!vehicleId,
  });

  if (jobsQuery.isLoading) return { kind: 'loading' };

  if (jobsQuery.isError) {
    return { kind: 'error', retry: () => jobsQuery.refetch() };
  }

  if (!vehicleId) {
    return { kind: 'no-vehicle', reason: 'no-job-history' };
  }

  if (vehicleQuery.isLoading) return { kind: 'loading' };

  if (vehicleQuery.isError) {
    if (isForbiddenError(vehicleQuery.error)) return { kind: 'unauthorized' };
    if (isNotFoundError(vehicleQuery.error)) return { kind: 'no-vehicle', reason: 'vehicle-not-found' };
    return { kind: 'error', retry: () => vehicleQuery.refetch() };
  }

  if (!vehicleQuery.data) {
    return { kind: 'no-vehicle', reason: 'vehicle-not-found' };
  }

  return { kind: 'ready', vehicle: vehicleQuery.data };
}
