import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverProfileScreen } from '../../../src/features/driver/profile/DriverProfileScreen';

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn().mockResolvedValue(undefined) }),
}));

function driverPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'd1',
    employeeId: 'DRV-000001',
    userId: {
      _id: 'user-1',
      firstName: 'Ahmed',
      lastName: 'Khan',
      email: 'ahmed@example.com',
      phone: '+971500000001',
    },
    companyId: 'c1',
    status: 'AVAILABLE',
    approvalStatus: 'APPROVED',
    rating: 4.5,
    totalTrips: 10,
    nationalId: 'n1',
    emiratesId: 'e1',
    emiratesIdExpiry: '2030-01-01',
    drivingLicenseNumber: 'dl1',
    drivingLicenseExpiry: '2030-01-01',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('DriverProfileScreen', () => {
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
            <DriverProfileScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('renders the driver identity, approval status, and menu items from real data', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Ahmed Khan')).toBeTruthy());
    expect(getByText('DRV-000001')).toBeTruthy();
    expect(getByText('Approved')).toBeTruthy();
    expect(getByText('ahmed@example.com')).toBeTruthy();
    expect(getByText('+971500000001')).toBeTruthy();
    expect(getByText('Edit Profile')).toBeTruthy();
    expect(getByText('Vehicle')).toBeTruthy();
    expect(getByText('Documents')).toBeTruthy();
    expect(getByText('Log out')).toBeTruthy();
  });

  it('shows a pending-approval chip without inventing an approved state', async () => {
    mock
      .onGet('/drivers/me')
      .reply(200, { success: true, data: driverPayload({ approvalStatus: 'PENDING_APPROVAL' }) });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Pending Approval')).toBeTruthy());
  });

  it('shows an error state when the profile fails to load', async () => {
    mock.onGet('/drivers/me').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
