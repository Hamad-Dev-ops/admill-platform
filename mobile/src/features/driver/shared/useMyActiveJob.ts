import { useQuery } from '@tanstack/react-query';
import { listJobs } from '../../../api/jobs.api';
import type { JobStatus } from '../../../types/enums';

// A driver can only ever have one job in an in-progress status at a time
// (accepting sets them ON_JOB, which blocks further offers — JOB-LIFECYCLE.md)
// — no dedicated "my active job" endpoint exists, so this scans the driver's
// own (already self-scoped by GET /jobs) recent jobs for one.
const ACTIVE_STATUSES: JobStatus[] = ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'STARTED'];

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
