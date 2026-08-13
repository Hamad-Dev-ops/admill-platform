import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { JobDetailScreen } from '../../../src/features/owner/jobs/JobDetailScreen';

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    companyId: 'c1',
    customerId: 'cust1',
    driverId: 'd1',
    offeredDriverIds: ['d1'],
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
    ...overrides,
  };
}

describe('JobDetailScreen', () => {
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
            <JobDetailScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{ params: { jobId: 'j1' } } as never}
            />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('offers a Cancel Job action for a non-terminal job and calls PATCH .../status', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload() });
    mock.onGet('/drivers').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });
    mock.onGet('/vehicles').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });
    mock
      .onPatch('/jobs/j1/status')
      .reply(200, { success: true, data: jobPayload({ status: 'CANCELLED', cancellationReason: 'Test' }) });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Cancel Job')).toBeTruthy());
    fireEvent.press(screen.getByText('Cancel Job'));

    await waitFor(() => expect(screen.getByTestId('cancel-reason-input')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('cancel-reason-input'), 'Customer requested cancellation');
    await waitFor(() =>
      expect(screen.getByTestId('cancel-reason-input').props.value).toBe(
        'Customer requested cancellation',
      ),
    );
    fireEvent.press(screen.getByText('Confirm Cancellation'));

    await waitFor(() => {
      const call = mock.history.patch.find((req) => req.url === '/jobs/j1/status');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({
        status: 'CANCELLED',
        cancellationReason: 'Customer requested cancellation',
      });
    });
  });

  it('does not offer a Cancel action for a COMPLETED job', async () => {
    mock.onGet('/jobs/j1').reply(200, {
      success: true,
      data: jobPayload({ status: 'COMPLETED', finalFare: 80, completedAt: '2026-01-02' }),
    });
    mock.onGet('/drivers').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });
    mock.onGet('/vehicles').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('JOB-20260810-000001')).toBeTruthy());
    expect(screen.queryByText('Cancel Job')).toBeNull();
  });
});
