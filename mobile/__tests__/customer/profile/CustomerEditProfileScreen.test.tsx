import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { CustomerEditProfileScreen } from '../../../src/features/customer/profile/CustomerEditProfileScreen';

function customerPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'cus1',
    customerCode: 'CUS-000001',
    userId: 'u1',
    nationalId: 'NID-1',
    address: 'Al Quoz, Dubai',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('CustomerEditProfileScreen', () => {
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
            <CustomerEditProfileScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('pre-fills the form from the real customer profile', async () => {
    mock.onGet('/customers/me').reply(200, { success: true, data: customerPayload() });

    const { getByDisplayValue } = await renderScreen();

    await waitFor(() => expect(getByDisplayValue('NID-1')).toBeTruthy());
    expect(getByDisplayValue('Al Quoz, Dubai')).toBeTruthy();
  });

  it('submits exactly {nationalId, address} to PATCH /customers/me and goes back on success', async () => {
    mock.onGet('/customers/me').reply(200, { success: true, data: customerPayload() });
    mock.onPatch('/customers/me').reply(200, { success: true, data: customerPayload({ nationalId: 'NID-2' }) });

    const { getByDisplayValue, getByTestId, getByText } = await renderScreen();

    await waitFor(() => expect(getByDisplayValue('NID-1')).toBeTruthy());
    await fireEvent.changeText(getByTestId('edit-nationalId-input'), 'NID-2');
    await fireEvent.press(getByText('Save Changes'));

    await waitFor(() => expect(mock.history.patch.length).toBe(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({
      nationalId: 'NID-2',
      address: 'Al Quoz, Dubai',
    });
  });

  it('shows the backend error message when the update fails', async () => {
    mock.onGet('/customers/me').reply(200, { success: true, data: customerPayload() });
    mock.onPatch('/customers/me').reply(400, { success: false, message: 'nationalId: Required' });

    const { getByDisplayValue, getByTestId, getByText } = await renderScreen();

    await waitFor(() => expect(getByDisplayValue('NID-1')).toBeTruthy());
    await fireEvent.changeText(getByTestId('edit-nationalId-input'), 'NID-2');
    await fireEvent.press(getByText('Save Changes'));

    await waitFor(() => expect(getByText('nationalId: Required')).toBeTruthy());
  });

  it('shows an error state when the profile fails to load', async () => {
    mock.onGet('/customers/me').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
