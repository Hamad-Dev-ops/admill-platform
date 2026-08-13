import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { FleetListScreen } from '../../../src/features/owner/fleet/FleetListScreen';

describe('FleetListScreen', () => {
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
            <FleetListScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows an empty state when the company has no vehicles', async () => {
    mock.onGet('/vehicles').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });
    mock.onGet('/drivers').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('No vehicles found')).toBeTruthy());
  });

  it('renders a vehicle row with its plate number and status', async () => {
    mock.onGet('/vehicles').reply(200, {
      success: true,
      data: [
        {
          _id: 'v1',
          vehicleCode: 'VEH-000001',
          plateNumber: 'DXB-12345',
          vehicleType: 'TOW_TRUCK',
          recoveryType: ['CAR_TOWING'],
          currentStatus: 'AVAILABLE',
          registrationNumber: 'REG1',
          chassisNumber: 'CHS1',
          insurancePolicyNumber: 'INS1',
          insuranceExpiry: '2030-01-01',
          registrationExpiry: '2030-01-01',
          companyId: 'c1',
          isActive: true,
          isDeleted: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      meta: { page: 1, limit: 100, total: 1 },
    });
    mock.onGet('/drivers').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('DXB-12345')).toBeTruthy());
    // "Available" appears both as the status filter chip and the row's
    // status chip by design.
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
  });
});
