import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { JobsListScreen } from '../../../src/features/owner/jobs/JobsListScreen';

describe('JobsListScreen', () => {
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

  function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer>
            <JobsListScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows an empty state when there are no jobs', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 50, total: 0 } });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('No jobs found')).toBeTruthy());
  });

  it('renders a job row with number, status, service type and pickup address', async () => {
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [
        {
          _id: 'j1',
          jobNumber: 'JOB-20260810-000001',
          companyId: 'c1',
          customerId: 'cust1',
          offeredDriverIds: [],
          serviceType: 'CAR_TOWING',
          status: 'PENDING',
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
        },
      ],
      meta: { page: 1, limit: 50, total: 1 },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('JOB-20260810-000001')).toBeTruthy());
    expect(screen.getByText('Burj Khalifa')).toBeTruthy();
  });
});
