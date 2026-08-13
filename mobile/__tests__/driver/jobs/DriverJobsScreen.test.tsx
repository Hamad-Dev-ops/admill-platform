import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverJobsScreen } from '../../../src/features/driver/jobs/DriverJobsScreen';

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    companyId: 'c1',
    customerId: 'cust1',
    driverId: 'd1',
    offeredDriverIds: ['d1'],
    serviceType: 'CAR_TOWING',
    status: 'EN_ROUTE',
    pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'Burj Khalifa' },
    destinationLocation: { geo: { type: 'Point', coordinates: [55.14, 25.08] }, address: 'Marina' },
    distanceKm: 12,
    durationMinutes: 20,
    estimatedFare: 80,
    expiresAt: '2030-01-01',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('DriverJobsScreen', () => {
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
          <NavigationContainer>
            <DriverJobsScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows only active-status jobs on the Active tab by default', async () => {
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [jobPayload({ _id: 'j1', status: 'EN_ROUTE' }), jobPayload({ _id: 'j2', status: 'COMPLETED' })],
      meta: { page: 1, limit: 50, total: 2 },
    });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('JOB-20260810-000001')).toBeTruthy());
    // Only the EN_ROUTE job is shown on the Active tab; the COMPLETED one is
    // filtered out (it belongs on History).
    expect(queryByText('En Route')).toBeTruthy();
    expect(queryByText('Completed')).toBeNull();
  });

  it('shows an empty state when there are no active jobs', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 50, total: 0 } });

    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('No active jobs')).toBeTruthy());
  });
});
