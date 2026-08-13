import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { CustomerJobsScreen } from '../../../src/features/customer/jobs/CustomerJobsScreen';

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    companyId: 'c1',
    customerId: 'cus1',
    offeredDriverIds: [],
    serviceType: 'CAR_TOWING',
    status: 'PENDING',
    pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'Sheikh Zayed Rd' },
    destinationLocation: { geo: { type: 'Point', coordinates: [55.14, 25.08] }, address: 'Al Quoz' },
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

describe('CustomerJobsScreen', () => {
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
            <CustomerJobsScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows only active-status jobs (including PENDING) on the Active tab by default', async () => {
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [jobPayload({ _id: 'j1', status: 'PENDING' }), jobPayload({ _id: 'j2', status: 'COMPLETED' })],
      meta: { page: 1, limit: 50, total: 2 },
    });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('JOB-20260810-000001')).toBeTruthy());
    expect(queryByText('Pending')).toBeTruthy();
    expect(queryByText('Completed')).toBeNull();
  });

  it('shows history jobs on the History tab', async () => {
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [
        jobPayload({ _id: 'j1', status: 'PENDING' }),
        jobPayload({ _id: 'j2', jobNumber: 'JOB-2', status: 'COMPLETED', finalFare: 95 }),
      ],
      meta: { page: 1, limit: 50, total: 2 },
    });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('JOB-20260810-000001')).toBeTruthy());
    await fireEvent.press(getByText('History'));

    await waitFor(() => expect(getByText('JOB-2')).toBeTruthy());
    expect(getByText('AED 95.00')).toBeTruthy();
    expect(queryByText('JOB-20260810-000001')).toBeNull();
  });

  it('shows an empty state when there are no active trips', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 50, total: 0 } });

    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('No active trips')).toBeTruthy());
  });

  it('shows an error state when the jobs list fails to load', async () => {
    mock.onGet('/jobs').reply(500);

    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
