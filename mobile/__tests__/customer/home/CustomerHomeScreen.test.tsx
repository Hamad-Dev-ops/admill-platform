import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { CustomerHomeScreen } from '../../../src/features/customer/home/CustomerHomeScreen';

jest.mock('../../../src/hooks/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: () => 0,
}));

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

describe('CustomerHomeScreen', () => {
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
            <CustomerHomeScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows the "Need recovery?" entry point when there is no active job, with no fabricated availability stats', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('Need recovery?')).toBeTruthy());
    expect(getByText('Request Recovery')).toBeTruthy();
    // Design's fabricated stats must never appear — no backend source for them.
    expect(queryByText(/online now/i)).toBeNull();
    expect(queryByText(/nearest unit/i)).toBeNull();
  });

  it('shows the active job card instead of the request entry point when one exists, including PENDING (routed to matching, not tracking)', async () => {
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [jobPayload({ status: 'PENDING' })],
      meta: { page: 1, limit: 20, total: 1 },
    });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('JOB-20260810-000001')).toBeTruthy());
    // PENDING hasn't been matched yet — "View request" (→ FindingDriver),
    // not "View trip" (→ JobDetail tracking).
    expect(getByText('View request')).toBeTruthy();
    expect(queryByText('Request Recovery')).toBeNull();
  });

  it('shows "View trip" for an already-accepted active job', async () => {
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [jobPayload({ status: 'EN_ROUTE' })],
      meta: { page: 1, limit: 20, total: 1 },
    });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('View trip')).toBeTruthy());
  });

  it('shows an error state when the jobs lookup fails', async () => {
    mock.onGet('/jobs').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
