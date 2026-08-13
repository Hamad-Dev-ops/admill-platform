import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverEditProfileScreen } from '../../../src/features/driver/profile/DriverEditProfileScreen';

function driverPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'd1',
    employeeId: 'DRV-000001',
    userId: 'user-1',
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

describe('DriverEditProfileScreen', () => {
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
            <DriverEditProfileScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('pre-fills the form from the real driver profile', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });

    const { getByDisplayValue } = await renderScreen();

    await waitFor(() => expect(getByDisplayValue('n1')).toBeTruthy());
    expect(getByDisplayValue('e1')).toBeTruthy();
    expect(getByDisplayValue('dl1')).toBeTruthy();
  });

  it('submits only the backend-accepted fields to PATCH /drivers/:id and goes back on success', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });
    mock.onPatch('/drivers/d1').reply(200, { success: true, data: driverPayload({ nationalId: 'n2' }) });

    const { getByDisplayValue, getByTestId, getByText } = await renderScreen();

    await waitFor(() => expect(getByDisplayValue('n1')).toBeTruthy());
    await fireEvent.changeText(getByTestId('edit-nationalId-input'), 'n2');
    await fireEvent.press(getByText('Save Changes'));

    await waitFor(() => expect(mock.history.patch.length).toBe(1));
    const body = JSON.parse(mock.history.patch[0].data);
    expect(body).toEqual({
      nationalId: 'n2',
      emiratesId: 'e1',
      emiratesIdExpiry: '2030-01-01',
      drivingLicenseNumber: 'dl1',
      drivingLicenseExpiry: '2030-01-01',
    });
  });

  it('shows an error state when the profile fails to load', async () => {
    mock.onGet('/drivers/me').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
