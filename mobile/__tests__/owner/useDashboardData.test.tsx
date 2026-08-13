import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../src/api/client';
import { useDashboardData } from '../../src/features/owner/dashboard/useDashboardData';

describe('useDashboardData', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
  });

  afterEach(() => {
    mock.restore();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('sums the 4 active-status job counts and exposes fleet/revenue data', async () => {
    mock.onGet('/analytics/fleet-utilization').reply(200, {
      success: true,
      data: { totalVehicles: 5, statusBreakdown: { AVAILABLE: 3, ON_RECOVERY: 2 }, vehicles: [] },
    });
    mock.onGet('/analytics/revenue').reply(200, {
      success: true,
      data: { startDate: '', endDate: '', totalRevenue: 1200, completedJobsCount: 4, averageFare: 300 },
    });
    mock.onGet('/jobs').reply((config) => {
      const status = config.params?.status;
      const countsByStatus: Record<string, number> = {
        PENDING: 2,
        ACCEPTED: 1,
        EN_ROUTE: 1,
        ARRIVED: 0,
        STARTED: 3,
      };
      const total = status ? (countsByStatus[status] ?? 0) : 7;
      return [200, { success: true, data: [], meta: { page: 1, limit: 1, total } }];
    });

    const { result } = await renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.fleet?.totalVehicles).toBe(5);
    expect(result.current.revenue?.totalRevenue).toBe(1200);
    expect(result.current.pendingJobsCount).toBe(2);
    // ACCEPTED(1) + EN_ROUTE(1) + ARRIVED(0) + STARTED(3) = 5
    expect(result.current.activeJobsCount).toBe(5);
    expect(result.current.completedJobsToday).toBe(4);
  });

  it('reports isError when a request fails', async () => {
    mock.onGet('/analytics/fleet-utilization').reply(500, { success: false, message: 'boom' });
    mock.onGet('/analytics/revenue').reply(200, {
      success: true,
      data: { startDate: '', endDate: '', totalRevenue: 0, completedJobsCount: 0, averageFare: 0 },
    });
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 1, total: 0 } });

    const { result } = await renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
  });

  it('reports isRefetching only while a refetch (not the initial load) is in flight', async () => {
    mock.onGet('/analytics/fleet-utilization').reply(200, {
      success: true,
      data: { totalVehicles: 5, statusBreakdown: { AVAILABLE: 3, ON_RECOVERY: 2 }, vehicles: [] },
    });
    mock.onGet('/analytics/revenue').reply(200, {
      success: true,
      data: { startDate: '', endDate: '', totalRevenue: 1200, completedJobsCount: 4, averageFare: 300 },
    });
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 1, total: 0 } });

    const { result } = await renderHook(() => useDashboardData(), { wrapper });

    // Never true during the initial load — that's what isLoading/LoadingState
    // already covers; isRefetching is specifically the *second* fetch.
    expect(result.current.isRefetching).toBe(false);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRefetching).toBe(false);

    let resolveRefetch: () => void = () => {};
    mock.onGet('/analytics/fleet-utilization').reply(
      () => new Promise((resolve) => {
        resolveRefetch = () => resolve([200, {
          success: true,
          data: { totalVehicles: 9, statusBreakdown: { AVAILABLE: 4, ON_RECOVERY: 2 }, vehicles: [] },
        }]);
      }),
    );

    result.current.refetchAll();
    await waitFor(() => expect(result.current.isRefetching).toBe(true));

    resolveRefetch();
    await waitFor(() => expect(result.current.isRefetching).toBe(false));
    expect(result.current.fleet?.totalVehicles).toBe(9);
  });
});
