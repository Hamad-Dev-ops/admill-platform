import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriversTabContent } from '../../../src/features/owner/drivers/DriversTabContent';

describe('DriversTabContent', () => {
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
            <DriversTabContent />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('renders a driver row using employeeId (list endpoint never populates identity)', async () => {
    mock.onGet('/drivers').reply(200, {
      success: true,
      data: [
        {
          _id: 'd1',
          employeeId: 'DRV-000042',
          userId: 'user-1',
          companyId: 'c1',
          status: 'AVAILABLE',
          approvalStatus: 'PENDING_APPROVAL',
          rating: 4.5,
          totalTrips: 12,
          nationalId: 'n1',
          emiratesId: 'e1',
          emiratesIdExpiry: '2030-01-01',
          drivingLicenseNumber: 'dl1',
          drivingLicenseExpiry: '2030-01-01',
          isActive: true,
          isDeleted: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      meta: { page: 1, limit: 100, total: 1 },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('DRV-000042')).toBeTruthy());
    // "Pending Approval" appears both as the filter chip and the row's
    // status chip by design.
    expect(screen.getAllByText('Pending Approval').length).toBeGreaterThan(0);
    expect(screen.getByText('Rating 4.5 · 12 trips')).toBeTruthy();
  });

  it('shows an empty state when there are no drivers', async () => {
    mock.onGet('/drivers').reply(200, { success: true, data: [], meta: { page: 1, limit: 100, total: 0 } });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('No drivers found')).toBeTruthy());
  });
});
