import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverEarningsScreen } from '../../../src/features/driver/earnings/DriverEarningsScreen';

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
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

describe('DriverEarningsScreen', () => {
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

  async function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <DriverEarningsScreen />
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('renders the real total earnings and completed-trip count derived from GET /jobs?status=COMPLETED', async () => {
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [jobPayload({ _id: 'j1', finalFare: 80 }), jobPayload({ _id: 'j2', jobNumber: 'JOB-2', finalFare: 120 })],
      meta: { page: 1, limit: 100, total: 2 },
    });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('AED 200.00')).toBeTruthy());
    expect(getByText('2')).toBeTruthy();
    expect(getByText('JOB-20260810-000001')).toBeTruthy();
    expect(getByText('JOB-2')).toBeTruthy();
  });

  it('shows an honest empty state with no completed trips instead of a zeroed chart', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('No completed trips yet')).toBeTruthy());
  });

  it('shows an error state when the jobs request fails', async () => {
    mock.onGet('/jobs').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
