import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverJobDetailScreen } from '../../../src/features/driver/jobs/DriverJobDetailScreen';

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    companyId: 'c1',
    customerId: 'cust1',
    driverId: 'd1',
    offeredDriverIds: ['d1'],
    serviceType: 'CAR_TOWING',
    status: 'ACCEPTED',
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

describe('DriverJobDetailScreen', () => {
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
            <DriverJobDetailScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{ params: { jobId: 'j1' } } as never}
            />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows the correct next-action button for ACCEPTED and calls PATCH with EN_ROUTE', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'ACCEPTED' }) });
    mock.onPatch('/jobs/j1/status').reply(200, { success: true, data: jobPayload({ status: 'EN_ROUTE' }) });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Start Driving (En Route)')).toBeTruthy());
    await fireEvent.press(getByText('Start Driving (En Route)'));

    await waitFor(() => {
      const call = mock.history.patch.find((req) => req.url === '/jobs/j1/status');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ status: 'EN_ROUTE' });
    });
  });

  it('shows "Complete Job" for STARTED', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'STARTED' }) });

    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Complete Job')).toBeTruthy());
  });

  it('hides the progression button and the cancel action for a COMPLETED job', async () => {
    mock.onGet('/jobs/j1').reply(200, {
      success: true,
      data: jobPayload({ status: 'COMPLETED', finalFare: 80, completedAt: '2026-01-02' }),
    });

    const { queryByText, getByText } = await renderScreen();

    await waitFor(() => expect(getByText('JOB-20260810-000001')).toBeTruthy());
    expect(queryByText('Complete Job')).toBeNull();
    expect(queryByText('Cancel Job')).toBeNull();
  });

  it('cancels the job with a reason', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'ACCEPTED' }) });
    mock
      .onPatch('/jobs/j1/status')
      .reply(200, { success: true, data: jobPayload({ status: 'CANCELLED', cancellationReason: 'Test' }) });

    const { getByText, getByTestId } = await renderScreen();

    await waitFor(() => expect(getByText('Cancel Job')).toBeTruthy());
    await fireEvent.press(getByText('Cancel Job'));

    await waitFor(() => expect(getByTestId('driver-cancel-reason-input')).toBeTruthy());
    await fireEvent.changeText(getByTestId('driver-cancel-reason-input'), 'Vehicle broke down');
    await waitFor(() =>
      expect(getByTestId('driver-cancel-reason-input').props.value).toBe('Vehicle broke down'),
    );

    await fireEvent.press(getByText('Confirm Cancellation'));

    await waitFor(() => {
      const call = mock.history.patch.find((req) => req.url === '/jobs/j1/status');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({
        status: 'CANCELLED',
        cancellationReason: 'Vehicle broke down',
      });
    });
  });
});
