import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverVehicleScreen } from '../../../src/features/driver/vehicle/DriverVehicleScreen';

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    companyId: 'c1',
    customerId: 'cust1',
    driverId: 'd1',
    vehicleId: 'v1',
    offeredDriverIds: ['d1'],
    serviceType: 'CAR_TOWING',
    status: 'COMPLETED',
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

function vehiclePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'v1',
    vehicleCode: 'VEH-000001',
    companyId: 'c1',
    plateNumber: 'DXB-99999',
    vehicleType: 'TOW_TRUCK',
    recoveryType: ['CAR_TOWING'],
    currentStatus: 'AVAILABLE',
    registrationNumber: 'REG1',
    chassisNumber: 'CHS1',
    insurancePolicyNumber: 'INS1',
    insuranceExpiry: '2030-01-01',
    registrationExpiry: '2030-01-01',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('DriverVehicleScreen', () => {
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
            <DriverVehicleScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('derives and renders the vehicle from the most recent job with a vehicleId', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    mock.onGet('/vehicles/v1').reply(200, { success: true, data: vehiclePayload() });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('DXB-99999')).toBeTruthy());
    expect(getByText('VEH-000001')).toBeTruthy();
    expect(getByText('Tow Truck')).toBeTruthy();
  });

  it('shows an honest empty state when the driver has no job history to derive a vehicle from', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('No vehicle found')).toBeTruthy());
    expect(getByText(/haven't completed any jobs yet/i)).toBeTruthy();
  });

  it('shows an error state when the jobs lookup fails', async () => {
    mock.onGet('/jobs').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });

  it('shows a genuine 404 on the vehicle itself as "no vehicle found", not an authorization error', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    mock.onGet('/vehicles/v1').reply(404, { success: false, message: 'Vehicle not found' });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('No vehicle found')).toBeTruthy());
    expect(getByText(/no longer available/i)).toBeTruthy();
  });

  it('shows a distinct, honest "not assigned to you" state on a real 403 — not a scary generic error, not "no vehicle"', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    mock.onGet('/vehicles/v1').reply(403, { success: false, message: 'You do not have permission to access this vehicle' });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('Not assigned to you')).toBeTruthy());
    expect(getByText(/now assigned to a different driver/i)).toBeTruthy();
    // Must not be conflated with either of the other two distinct states.
    expect(queryByText('No vehicle found')).toBeNull();
    expect(queryByText('Something went wrong')).toBeNull();
  });

  it('shows a retryable error state (not "no vehicle") on a real backend/network failure fetching the vehicle itself', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    mock.onGet('/vehicles/v1').reply(500, { success: false, message: 'Internal error' });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
    expect(queryByText('No vehicle found')).toBeNull();
    expect(queryByText('Not assigned to you')).toBeNull();
  });

  it('recovers to the real vehicle after Retry once the backend responds successfully', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    let attempt = 0;
    mock.onGet('/vehicles/v1').reply(() => {
      attempt += 1;
      if (attempt === 1) return [500, { success: false, message: 'Internal error' }];
      return [200, { success: true, data: vehiclePayload() }];
    });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
    await fireEvent.press(getByText('Retry'));

    await waitFor(() => expect(getByText('DXB-99999')).toBeTruthy());
    expect(attempt).toBe(2);
  });
});
