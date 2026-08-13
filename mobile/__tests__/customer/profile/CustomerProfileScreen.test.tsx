import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { CustomerProfileScreen } from '../../../src/features/customer/profile/CustomerProfileScreen';

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn().mockResolvedValue(undefined) }),
}));

function customerPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'cus1',
    customerCode: 'CUS-000001',
    userId: { _id: 'u1', firstName: 'Cara', lastName: 'Customer', email: 'c@x.com', phone: '+971500000001' },
    nationalId: 'NID-1',
    address: 'Al Quoz, Dubai',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('CustomerProfileScreen', () => {
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
            <CustomerProfileScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('renders real identity, customer code, national ID, address, and a derived completed-trips count', async () => {
    mock.onGet('/customers/me').reply(200, { success: true, data: customerPayload() });
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 1, total: 7 } });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Cara Customer')).toBeTruthy());
    expect(getByText('CUS-000001')).toBeTruthy();
    expect(getByText('c@x.com')).toBeTruthy();
    expect(getByText('+971500000001')).toBeTruthy();
    expect(getByText('NID-1')).toBeTruthy();
    expect(getByText('Al Quoz, Dubai')).toBeTruthy();
    await waitFor(() => expect(getByText('7')).toBeTruthy());

    // The dead backend fields must never appear anywhere on this screen.
    expect(mock.history.get.find((req) => req.url === '/drivers/me')).toBeUndefined();
  });

  it('shows "Not provided" when the optional address field is absent', async () => {
    mock.onGet('/customers/me').reply(200, { success: true, data: customerPayload({ address: undefined }) });
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 1, total: 0 } });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Not provided')).toBeTruthy());
  });

  it('shows an error state when the profile fails to load', async () => {
    mock.onGet('/customers/me').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
