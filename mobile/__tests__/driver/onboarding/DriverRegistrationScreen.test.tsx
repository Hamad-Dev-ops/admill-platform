import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverRegistrationScreen } from '../../../src/features/driver/onboarding/DriverRegistrationScreen';

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn().mockResolvedValue(undefined) }),
}));

describe('DriverRegistrationScreen', () => {
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
    const utils = await render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <DriverRegistrationScreen />
        </PaperProvider>
      </QueryClientProvider>,
    );
    return { ...utils, queryClient };
  }

  it('submits POST /drivers with the exact backend field names and invalidates the profile query on success', async () => {
    mock.onPost('/drivers').reply(201, {
      success: true,
      data: {
        _id: 'd1',
        employeeId: 'DRV-000001',
        approvalStatus: 'PENDING_APPROVAL',
      },
      message: 'Driver registered — pending approval',
    });

    const { getByTestId, getByText, queryClient } = await renderScreen();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    // fireEvent.changeText/.press are async in this RNTL version — each must
    // be awaited or their internal act() scopes overlap and corrupt the test
    // renderer's state for whatever test runs next in this file.
    await fireEvent.changeText(getByTestId('companyCode-input'), 'CMP-000001');
    await fireEvent.changeText(getByTestId('nationalId-input'), 'NID-123');
    await fireEvent.changeText(getByTestId('emiratesId-input'), '784-123');
    await fireEvent.changeText(getByTestId('emiratesIdExpiry-input'), '2030-01-01');
    await fireEvent.changeText(getByTestId('drivingLicenseNumber-input'), 'DL-123');
    await fireEvent.changeText(getByTestId('drivingLicenseExpiry-input'), '2030-01-01');

    await fireEvent.press(getByText('Submit Application'));

    await waitFor(() => {
      const call = mock.history.post.find((req) => req.url === '/drivers');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({
        companyCode: 'CMP-000001',
        nationalId: 'NID-123',
        emiratesId: '784-123',
        emiratesIdExpiry: '2030-01-01',
        drivingLicenseNumber: 'DL-123',
        drivingLicenseExpiry: '2030-01-01',
      });
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['drivers', 'me'] }),
    );
  });

  it('shows a validation error and does not submit when required fields are empty', async () => {
    const { getByText } = await renderScreen();

    await fireEvent.press(getByText('Submit Application'));

    await waitFor(() => expect(getByText('Company code is required')).toBeTruthy());
    expect(mock.history.post.length).toBe(0);
  });
});
