import type { DriverProgressStatus } from '../../../api/jobs.api';
import type { JobStatus } from '../../../types/enums';

// The exact 4 transitions a Driver may trigger, and only in this order —
// verified against job.state-machine.ts + assertStatusChangeAllowed during
// the Phase 3 preflight. Anything not a key here has no driver action
// (either not yet accepted, or already terminal).
export const NEXT_DRIVER_STATUS: Partial<Record<JobStatus, DriverProgressStatus>> = {
  ACCEPTED: 'EN_ROUTE',
  EN_ROUTE: 'ARRIVED',
  ARRIVED: 'STARTED',
  STARTED: 'COMPLETED',
};

export const PROGRESS_ACTION_LABEL: Record<DriverProgressStatus, string> = {
  EN_ROUTE: 'Start Driving (En Route)',
  ARRIVED: 'Mark as Arrived',
  STARTED: 'Start Recovery',
  COMPLETED: 'Complete Job',
};

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED' || status === 'EXPIRED';
}
