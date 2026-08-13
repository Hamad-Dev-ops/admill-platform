import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { CustomerNavigator } from '../../../src/navigation/CustomerNavigator';

const mockUseProfileStatus = jest.fn();
jest.mock('../../../src/hooks/useProfileStatus', () => ({
  useProfileStatus: () => mockUseProfileStatus(),
}));

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', firstName: 'Cara', lastName: 'Customer', email: 'c@x.com', phone: '1', role: 'CUSTOMER' },
    logout: jest.fn().mockResolvedValue(undefined),
  }),
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

describe('CustomerNavigator', () => {
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

  async function renderNavigator() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer>
            <CustomerNavigator />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows a loading state while profile status is unresolved', async () => {
    mockUseProfileStatus.mockReturnValue({ kind: 'loading' });
    const { queryByText } = await renderNavigator();
    // No tab bar / home content should render yet.
    expect(queryByText('Welcome, Cara Customer')).toBeNull();
  });

  it('shows the real registration form, not the tab shell, when there is no Customer profile yet', async () => {
    mockUseProfileStatus.mockReturnValue({ kind: 'no-profile' });
    const { getByTestId, getByText, queryByText } = await renderNavigator();
    await waitFor(() => expect(getByTestId('nationalId-input')).toBeTruthy());
    expect(getByText('Continue')).toBeTruthy();
    expect(queryByText('Welcome, Cara Customer')).toBeNull();
  });

  it('shows a retry error state, NOT the registration form, on a profile-status network/API error', async () => {
    const retry = jest.fn();
    mockUseProfileStatus.mockReturnValue({ kind: 'error', retry });
    const { getByText, queryByTestId } = await renderNavigator();

    await waitFor(() => expect(getByText('Connection problem')).toBeTruthy());
    expect(queryByTestId('nationalId-input')).toBeNull();

    await fireEvent.press(getByText('Retry'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('renders the 3-tab Customer shell (Home/Trips/Profile) with no Owner/Driver content, once ready', async () => {
    mockUseProfileStatus.mockReturnValue({ kind: 'ready' });
    const { getAllByText, queryByText } = await renderNavigator();

    await waitFor(() => expect(getAllByText('Home').length).toBeGreaterThan(0));
    expect(getAllByText('Trips').length).toBeGreaterThan(0);
    expect(getAllByText('Profile').length).toBeGreaterThan(0);

    // Navigation isolation — nothing Owner- or Driver-specific ever renders
    // for a CUSTOMER session (Phase 4 approval, instruction #9).
    expect(queryByText('Fleet')).toBeNull();
    expect(queryByText('Command Dashboard')).toBeNull();
    expect(queryByText('Go Online')).toBeNull();
    expect(queryByText('Earnings')).toBeNull();
  });

  it('switches to the Trips tab and renders the real (empty) trips list', async () => {
    mockUseProfileStatus.mockReturnValue({ kind: 'ready' });
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 50, total: 0 } });

    const { getAllByText, getByText } = await renderNavigator();

    await waitFor(() => expect(getAllByText('Trips').length).toBeGreaterThan(0));
    await fireEvent.press(getAllByText('Trips')[0]);

    await waitFor(() => expect(getByText('No active trips')).toBeTruthy());
  });

  it('switches to the Profile tab and renders the real profile content', async () => {
    mockUseProfileStatus.mockReturnValue({ kind: 'ready' });
    mock.onGet('/customers/me').reply(200, { success: true, data: customerPayload() });
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 1, total: 3 } });

    const { getAllByText, getByText } = await renderNavigator();

    await waitFor(() => expect(getAllByText('Profile').length).toBeGreaterThan(0));
    await fireEvent.press(getAllByText('Profile')[0]);

    await waitFor(() => expect(getByText('Cara Customer')).toBeTruthy());
    expect(getByText('CUS-000001')).toBeTruthy();
  });
});
