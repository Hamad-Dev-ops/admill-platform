import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { CompanySetupScreen } from '../../../src/features/owner/onboarding/CompanySetupScreen';

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn().mockResolvedValue(undefined) }),
}));

describe('CompanySetupScreen', () => {
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
          <CompanySetupScreen />
        </PaperProvider>
      </QueryClientProvider>,
    );
    return { ...utils, queryClient };
  }

  it('submits POST /companies with the exact backend field names (serviceAreas split from comma-separated text) and invalidates the profile query on success', async () => {
    mock.onPost('/companies').reply(201, {
      success: true,
      data: { _id: 'c1', companyCode: 'CMP-000001', companyName: 'Admill Test Co' },
      message: 'Company created successfully',
    });

    const { getByTestId, getByText, queryClient } = await renderScreen();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await fireEvent.changeText(getByTestId('companyName-input'), 'Admill Test Co');
    await fireEvent.changeText(getByTestId('email-input'), 'ops@admill.test');
    await fireEvent.changeText(getByTestId('phone-input'), '971500000000');
    await fireEvent.changeText(getByTestId('address-input'), '123 Sheikh Zayed Rd');
    await fireEvent.changeText(getByTestId('city-input'), 'Dubai');
    await fireEvent.changeText(getByTestId('country-input'), 'UAE');
    await fireEvent.changeText(getByTestId('tradeLicenseNumber-input'), 'TL-0001');
    await fireEvent.changeText(getByTestId('tradeLicenseExpiry-input'), '2030-01-01');
    await fireEvent.changeText(getByTestId('serviceAreas-input'), 'Dubai, Sharjah,  Ajman ');

    await fireEvent.press(getByText('Create Company'));

    await waitFor(() => {
      const call = mock.history.post.find((req) => req.url === '/companies');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({
        companyName: 'Admill Test Co',
        email: 'ops@admill.test',
        phone: '971500000000',
        address: '123 Sheikh Zayed Rd',
        city: 'Dubai',
        country: 'UAE',
        tradeLicenseNumber: 'TL-0001',
        tradeLicenseExpiry: '2030-01-01',
        serviceAreas: ['Dubai', 'Sharjah', 'Ajman'],
      });
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['companies', 'me'] }),
    );
  });

  it('shows a validation error and does not submit when required fields are empty', async () => {
    const { getByText } = await renderScreen();

    await fireEvent.press(getByText('Create Company'));

    await waitFor(() => expect(getByText('Company name is required')).toBeTruthy());
    expect(mock.history.post.length).toBe(0);
  });

  it('shows the real backend error message and does not invalidate the profile query on failure', async () => {
    mock.onPost('/companies').reply(409, { success: false, message: 'You already have a company registered' });

    const { getByTestId, getByText, queryClient } = await renderScreen();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await fireEvent.changeText(getByTestId('companyName-input'), 'Admill Test Co');
    await fireEvent.changeText(getByTestId('email-input'), 'ops@admill.test');
    await fireEvent.changeText(getByTestId('phone-input'), '971500000000');
    await fireEvent.changeText(getByTestId('address-input'), '123 Sheikh Zayed Rd');
    await fireEvent.changeText(getByTestId('city-input'), 'Dubai');
    await fireEvent.changeText(getByTestId('country-input'), 'UAE');
    await fireEvent.changeText(getByTestId('tradeLicenseNumber-input'), 'TL-0001');
    await fireEvent.changeText(getByTestId('tradeLicenseExpiry-input'), '2030-01-01');
    await fireEvent.changeText(getByTestId('serviceAreas-input'), 'Dubai');

    await fireEvent.press(getByText('Create Company'));

    await waitFor(() => expect(getByText('You already have a company registered')).toBeTruthy());
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
