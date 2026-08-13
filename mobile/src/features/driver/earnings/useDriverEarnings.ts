import { useQuery } from '@tanstack/react-query';
import { listJobs } from '../../../api/jobs.api';
import type { Job } from '../../../types/entities';

// GET /jobs is server-side paginated (max limit 100 — utils/pagination.ts).
// A driver's full completed-job history can exceed that, so this walks every
// page rather than silently truncating at the first 100 — an "earnings
// total" that quietly undercounts would be worse than one that's just slow.
const PAGE_LIMIT = 100;

async function fetchAllCompletedJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  let page = 1;

  for (;;) {
    const { data, meta } = await listJobs({ status: 'COMPLETED', page, limit: PAGE_LIMIT });
    jobs.push(...data);
    if (data.length === 0 || jobs.length >= meta.total) break;
    page += 1;
  }

  return jobs;
}

// No fabricated period breakdowns (weekly/monthly charts) — there is no
// backend earnings/analytics endpoint for drivers, only GET /jobs. This
// derives a single honest total, not an invented reporting feature.
export function useDriverEarnings() {
  const query = useQuery({
    queryKey: ['jobs', 'completed', 'earnings'],
    queryFn: fetchAllCompletedJobs,
  });

  const jobs = (query.data ?? []).slice().sort((a, b) => {
    const aDate = a.completedAt ?? a.updatedAt;
    const bDate = b.completedAt ?? b.updatedAt;
    return bDate.localeCompare(aDate);
  });

  const totalEarnings = jobs.reduce((sum, job) => sum + (job.finalFare ?? job.estimatedFare), 0);

  return {
    jobs,
    totalEarnings,
    completedTripsCount: jobs.length,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
