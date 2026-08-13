import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/api/client';
import { AuthProvider } from '../../src/auth/AuthContext';
import { LoginScreen } from '../../src/features/auth/LoginScreen';

const mockNavigate = jest.fn();

describe('LoginScreen', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mockNavigate.mockReset();
  });

  afterEach(() => {
    mock.restore();
  });

  async function renderAndSubmit(email: string, password: string) {
    // AuthProvider now reads useQueryClient() (to clear the cache on logout),
    // so it needs a real QueryClientProvider ancestor, same as everywhere
    // else AuthProvider is rendered in isolation.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const utils = await render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer>
            <LoginScreen
              // @ts-expect-error - minimal navigation stub for a unit test
              navigation={{ navigate: mockNavigate }}
              route={{ key: 'Login', name: 'Login' }}
            />
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await fireEvent.changeText(utils.getByTestId('email-input'), email);
    await fireEvent.changeText(utils.getByTestId('password-input'), password);
    await fireEvent.press(utils.getByText('Log in'));

    return utils;
  }

  it('shows the real backend message plus remaining attempts on a wrong-password 401 (from the RateLimit-Remaining header)', async () => {
    mock.onPost('/auth/login').reply(401, { success: false, message: 'Invalid credentials' }, { 'ratelimit-remaining': '3' });

    const { getByText } = await renderAndSubmit('test-customer@admill.test', 'wrong-password');

    await waitFor(() => expect(getByText('Invalid credentials (3 attempts remaining)')).toBeTruthy());
  });

  it('uses singular "attempt" when exactly one remains', async () => {
    mock.onPost('/auth/login').reply(401, { success: false, message: 'Invalid credentials' }, { 'ratelimit-remaining': '1' });

    const { getByText } = await renderAndSubmit('test-customer@admill.test', 'wrong-password');

    await waitFor(() => expect(getByText('Invalid credentials (1 attempt remaining)')).toBeTruthy());
  });

  it('does not append attempts-remaining text when the header is absent', async () => {
    mock.onPost('/auth/login').reply(401, { success: false, message: 'Invalid credentials' });

    const { getByText, queryByText } = await renderAndSubmit('test-customer@admill.test', 'wrong-password');

    await waitFor(() => expect(getByText('Invalid credentials')).toBeTruthy());
    expect(queryByText(/remaining/)).toBeNull();
  });

  it('shows the plain lockout message on a 429 without appending a stale remaining count', async () => {
    mock.onPost('/auth/login').reply(429, { success: false, message: 'Too many attempts, please try again later' }, { 'ratelimit-remaining': '0' });

    const { getByText } = await renderAndSubmit('test-customer@admill.test', 'wrong-password');

    await waitFor(() => expect(getByText('Too many attempts, please try again later')).toBeTruthy());
  });
});
