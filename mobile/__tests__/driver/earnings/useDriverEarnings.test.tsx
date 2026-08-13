import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { useDriverEarnings } from '../../../src/features/driver/earnings/useDriverEarnings';

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-1',
    companyId: 'c1',
    customerId: 'cust1',
    driverId: 'd1',
    offeredDriverIds: ['d1'],
    serviceType: 'CAR_TOWING',
    status: 'COMPLETED',
    pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'A' },
    destinationLocation: { geo: { type: 'Point', coordinates: [55.14, 25.08] }, address: 'B' },
    distanceKm: 12,
    durationMinutes: 20,
    estimatedFare: 80,
    finalFare: 80,
    expiresAt: '2030-01-01',
    completedAt: '2026-02-01T00:00:00.000Z',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('useDriverEarnings', () => {
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

  it('sums finalFare across a single page of completed jobs', async () => {
    mock.onGet('/jobs').reply((config) => {
      expect(config.params).toMatchObject({ status: 'COMPLETED', page: 1, limit: 100 });
      return [
        200,
        {
          success: true,
          data: [jobPayload({ _id: 'j1', finalFare: 80 }), jobPayload({ _id: 'j2', finalFare: 120 })],
          meta: { page: 1, limit: 100, total: 2 },
        },
      ];
    });

    const { result } = await renderHook(() => useDriverEarnings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalEarnings).toBe(200);
    expect(result.current.completedTripsCount).toBe(2);
  });

  it('walks every page instead of truncating at the server max limit', async () => {
    mock.onGet('/jobs').reply((config) => {
      const page = config.params.page;
      if (page === 1) {
        return [
          200,
          {
            success: true,
            data: [jobPayload({ _id: 'j1', finalFare: 100 })],
            meta: { page: 1, limit: 100, total: 2 },
          },
        ];
      }
      return [
        200,
        {
          success: true,
          data: [jobPayload({ _id: 'j2', finalFare: 50 })],
          meta: { page: 2, limit: 100, total: 2 },
        },
      ];
    });

    const { result } = await renderHook(() => useDriverEarnings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.completedTripsCount).toBe(2);
    expect(result.current.totalEarnings).toBe(150);
  });

  it('falls back to estimatedFare when finalFare is somehow missing', async () => {
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [jobPayload({ finalFare: undefined, estimatedFare: 65 })],
      meta: { page: 1, limit: 100, total: 1 },
    });

    const { result } = await renderHook(() => useDriverEarnings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalEarnings).toBe(65);
  });
});
