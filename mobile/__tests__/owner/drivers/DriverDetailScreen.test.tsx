import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverDetailScreen } from '../../../src/features/owner/drivers/DriverDetailScreen';

const driverPayload = {
  _id: 'd1',
  employeeId: 'DRV-000042',
  userId: { _id: 'user-1', firstName: 'Sam', lastName: 'Driver', email: 's@x.com', phone: '123' },
  companyId: 'c1',
  status: 'OFFLINE',
  approvalStatus: 'PENDING_APPROVAL',
  rating: 0,
  totalTrips: 0,
  nationalId: 'n1',
  emiratesId: 'e1',
  emiratesIdExpiry: '2030-01-01',
  drivingLicenseNumber: 'dl1',
  drivingLicenseExpiry: '2030-01-01',
  isActive: true,
  isDeleted: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('DriverDetailScreen', () => {
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
            <DriverDetailScreen
              navigation={{ goBack: jest.fn() } as never}
              route={{ params: { driverId: 'd1' } } as never}
            />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows the populated identity name and approve/reject actions for a pending driver', async () => {
    mock.onGet('/drivers/d1').reply(200, { success: true, data: driverPayload });
    mock.onGet('/vehicles').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });

    await renderScreen();
    // "Sam Driver" appears both as the Header title and the identity card
    // heading by design.
    await waitFor(() => expect(screen.getAllByText('Sam Driver').length).toBeGreaterThan(0));
    expect(screen.getByText('Approve')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('calls PATCH /drivers/:id/approve when Approve is pressed', async () => {
    mock.onGet('/drivers/d1').reply(200, { success: true, data: driverPayload });
    mock.onGet('/vehicles').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });
    mock.onPatch('/drivers/d1/approve').reply(200, {
      success: true,
      data: { ...driverPayload, approvalStatus: 'APPROVED' },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Approve')).toBeTruthy());
    fireEvent.press(screen.getByText('Approve'));

    await waitFor(() =>
      expect(mock.history.patch.some((req) => req.url === '/drivers/d1/approve')).toBe(true),
    );
  });
});
