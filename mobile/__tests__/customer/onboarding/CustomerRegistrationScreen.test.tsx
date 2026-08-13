import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { CustomerRegistrationScreen } from '../../../src/features/customer/onboarding/CustomerRegistrationScreen';

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn().mockResolvedValue(undefined) }),
}));

describe('CustomerRegistrationScreen', () => {
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
          <CustomerRegistrationScreen />
        </PaperProvider>
      </QueryClientProvider>,
    );
    return { ...utils, queryClient };
  }

  it('submits POST /customers with exactly {nationalId, address} and invalidates the profile query on success', async () => {
    mock.onPost('/customers').reply(201, {
      success: true,
      data: { _id: 'cus1', customerCode: 'CUS-000001', userId: 'u1', nationalId: 'NID-1', address: 'Al Quoz' },
      message: 'Customer registered successfully',
    });

    const { getByTestId, getByText, queryClient } = await renderScreen();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await fireEvent.changeText(getByTestId('nationalId-input'), 'NID-1');
    await fireEvent.changeText(getByTestId('address-input'), 'Al Quoz');
    await fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      const call = mock.history.post.find((req) => req.url === '/customers');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ nationalId: 'NID-1', address: 'Al Quoz' });
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['customers', 'me'] }),
    );
  });

  it('omits address entirely from the payload when left blank, never sending an empty string', async () => {
    mock.onPost('/customers').reply(201, {
      success: true,
      data: { _id: 'cus1', customerCode: 'CUS-000001', userId: 'u1', nationalId: 'NID-1' },
    });

    const { getByTestId, getByText } = await renderScreen();

    await fireEvent.changeText(getByTestId('nationalId-input'), 'NID-1');
    await fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      const call = mock.history.post.find((req) => req.url === '/customers');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ nationalId: 'NID-1' });
    });
  });

  it('shows a validation error and does not submit when National ID is empty', async () => {
    const { getByText } = await renderScreen();

    await fireEvent.press(getByText('Continue'));

    await waitFor(() => expect(getByText('National ID is required')).toBeTruthy());
    expect(mock.history.post.length).toBe(0);
  });

  it('shows the backend message when the profile already exists (409)', async () => {
    mock.onPost('/customers').reply(409, { success: false, message: 'You already have a customer profile' });

    const { getByTestId, getByText } = await renderScreen();

    await fireEvent.changeText(getByTestId('nationalId-input'), 'NID-1');
    await fireEvent.press(getByText('Continue'));

    await waitFor(() => expect(getByText('You already have a customer profile')).toBeTruthy());
  });
});
