import { apiClient } from './client';
import type { ApiSuccess } from '../types/api';
import type { DriverStat, FleetUtilization, RevenueSummary } from '../types/entities';

// frontend-docs/API-CONTRACT.md §Analytics — OWNER-only, no pagination.
// startDate/endDate are plain ISO strings, hand-parsed server-side; omit for
// all-time.

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export async function getRevenueSummary(params?: DateRangeParams): Promise<RevenueSummary> {
  const { data } = await apiClient.get<ApiSuccess<RevenueSummary>>('/analytics/revenue', {
    params,
  });
  return data.data;
}

export async function getDriverStats(params?: DateRangeParams): Promise<DriverStat[]> {
  const { data } = await apiClient.get<ApiSuccess<DriverStat[]>>('/analytics/drivers', {
    params,
  });
  return data.data;
}

export async function getFleetUtilization(
  params?: DateRangeParams,
): Promise<FleetUtilization> {
  const { data } = await apiClient.get<ApiSuccess<FleetUtilization>>(
    '/analytics/fleet-utilization',
    { params },
  );
  return data.data;
}
