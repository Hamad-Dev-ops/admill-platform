import { useQueries, useQuery } from '@tanstack/react-query';
import { getFleetUtilization, getRevenueSummary } from '../../../api/analytics.api';
import { listJobs } from '../../../api/jobs.api';
import type { JobStatus } from '../../../types/enums';

// "Active" jobs on the dashboard = the 4 in-progress statuses between
// ACCEPTED and COMPLETED (JOB-LIFECYCLE.md). The backend's ?status= filter
// only accepts one value at a time, so getting an accurate count per bucket
// means one small request per status — using limit:1 keeps each call cheap
// since only `meta.total` is read, not the actual page of jobs.
const ACTIVE_STATUSES: JobStatus[] = ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'STARTED'];

function todayRange() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { startDate: startOfDay.toISOString(), endDate: now.toISOString() };
}

export function useDashboardData() {
  const fleetQuery = useQuery({
    queryKey: ['analytics', 'fleet-utilization'],
    queryFn: () => getFleetUtilization(),
  });

  const revenueQuery = useQuery({
    queryKey: ['analytics', 'revenue', 'today'],
    queryFn: () => getRevenueSummary(todayRange()),
  });

  const pendingQuery = useQuery({
    queryKey: ['jobs', 'count', 'PENDING'],
    queryFn: async () => (await listJobs({ status: 'PENDING', limit: 1 })).meta.total,
  });

  const activeQueries = useQueries({
    queries: ACTIVE_STATUSES.map((status) => ({
      queryKey: ['jobs', 'count', status],
      queryFn: async () => (await listJobs({ status, limit: 1 })).meta.total,
    })),
  });

  const recentJobsQuery = useQuery({
    queryKey: ['jobs', 'recent'],
    queryFn: () => listJobs({ limit: 10 }),
  });

  const isLoading =
    fleetQuery.isLoading ||
    revenueQuery.isLoading ||
    pendingQuery.isLoading ||
    recentJobsQuery.isLoading ||
    activeQueries.some((q) => q.isLoading);

  const isError =
    fleetQuery.isError ||
    revenueQuery.isError ||
    pendingQuery.isError ||
    recentJobsQuery.isError ||
    activeQueries.some((q) => q.isError);

  // isFetching is true for the initial load too (isLoading is a subset of
  // it) — excluding that here is what makes this specifically a *refetch*
  // indicator, for RefreshControl's `refreshing` prop, distinct from the
  // full-screen initial LoadingState that isLoading already drives.
  const isFetching =
    fleetQuery.isFetching ||
    revenueQuery.isFetching ||
    pendingQuery.isFetching ||
    recentJobsQuery.isFetching ||
    activeQueries.some((q) => q.isFetching);
  const isRefetching = isFetching && !isLoading;

  const activeJobsCount = activeQueries.reduce((sum, q) => sum + (q.data ?? 0), 0);

  return {
    isLoading,
    isError,
    isRefetching,
    fleet: fleetQuery.data,
    revenue: revenueQuery.data,
    pendingJobsCount: pendingQuery.data ?? 0,
    activeJobsCount,
    completedJobsToday: revenueQuery.data?.completedJobsCount ?? 0,
    recentJobs: recentJobsQuery.data?.data ?? [],
    refetchAll: () => {
      fleetQuery.refetch();
      revenueQuery.refetch();
      pendingQuery.refetch();
      recentJobsQuery.refetch();
      activeQueries.forEach((q) => q.refetch());
    },
  };
}
