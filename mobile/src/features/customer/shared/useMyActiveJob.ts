import { useQuery } from '@tanstack/react-query';
import { listJobs } from '../../../api/jobs.api';
import type { JobStatus } from '../../../types/enums';

// A customer's own "in progress" definition is broader than a driver's —
// PENDING counts too, since it's their own just-created job still waiting
// to be matched (JOB-LIFECYCLE.md). No dedicated "my active job" endpoint
// exists, so this scans the customer's own (already self-scoped by
// GET /jobs) recent jobs for one, same technique as Driver's own hook.
const ACTIVE_STATUSES: JobStatus[] = ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'STARTED'];

export function useMyActiveJob() {
  const query = useQuery({
    queryKey: ['jobs', 'my-active'],
    queryFn: () => listJobs({ limit: 20 }),
  });

  const activeJob = query.data?.data.find((job) => ACTIVE_STATUSES.includes(job.status)) ?? null;

  return {
    activeJob,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
