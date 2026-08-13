import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import * as authApi from '../../src/api/auth.api';
import * as tokenStorage from '../../src/auth/tokenStorage';

jest.mock('../../src/api/auth.api');
jest.mock('../../src/socket/SocketService', () => ({
  SocketService: { connect: jest.fn(), disconnect: jest.fn(), reconnect: jest.fn() },
}));

const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

const authResult = {
  user: {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@admill.test',
    phone: '1234567',
    role: 'CUSTOMER' as const,
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAt: new Date().toISOString(),
};

function Probe() {
  const { status, user } = useAuth();
  return <Text testID="probe">{`${status}:${user?.email ?? 'none'}`}</Text>;
}

// AuthProvider now reads useQueryClient() (to clear the cache on logout —
// see the "final hardening" pass), so every render needs a real
// QueryClientProvider ancestor, same as any other hook that touches React
// Query.
function renderWithProviders(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStorage.clearRefreshToken();
  });

  it('starts unauthenticated when no refresh token is stored', async () => {
    const { getByTestId } = await renderWithProviders(<Probe />);

    await waitFor(() => {
      expect(getByTestId('probe').props.children).toBe('unauthenticated:none');
    });
    // A genuine "nothing stored" case must never call the refresh endpoint.
    expect(mockedAuthApi.refresh).not.toHaveBeenCalled();
  });

  it('becomes authenticated after a successful login', async () => {
    mockedAuthApi.login.mockResolvedValue(authResult);

    let auth!: ReturnType<typeof useAuth>;
    function Capture() {
      auth = useAuth();
      return <Probe />;
    }

    const { getByTestId } = await renderWithProviders(<Capture />);

    await waitFor(() => {
      expect(getByTestId('probe').props.children).toBe('unauthenticated:none');
    });

    await act(async () => {
      await auth.login('ada@admill.test', 'Password123!');
    });

    expect(getByTestId('probe').props.children).toBe('authenticated:ada@admill.test');
    expect(await tokenStorage.getRefreshToken()).toBe('refresh-token');
  });

  it('clears the session on logout', async () => {
    mockedAuthApi.login.mockResolvedValue(authResult);
    mockedAuthApi.logout.mockResolvedValue(undefined);

    let auth!: ReturnType<typeof useAuth>;
    function Capture() {
      auth = useAuth();
      return <Probe />;
    }

    const { getByTestId } = await renderWithProviders(<Capture />);

    await waitFor(() => expect(getByTestId('probe').props.children).toContain('unauthenticated'));
    await act(async () => {
      await auth.login('ada@admill.test', 'Password123!');
    });
    await act(async () => {
      await auth.logout();
    });

    expect(getByTestId('probe').props.children).toBe('unauthenticated:none');
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  describe('startup restore — distinguishing failure states (final hardening pass)', () => {
    it('silently restores the session from a stored refresh token on launch, without a manual login', async () => {
      await tokenStorage.saveRefreshToken('stored-refresh-token');
      mockedAuthApi.refresh.mockResolvedValue(authResult);

      const { getByTestId } = await renderWithProviders(<Probe />);

      await waitFor(() => {
        expect(getByTestId('probe').props.children).toBe('authenticated:ada@admill.test');
      });
      expect(mockedAuthApi.refresh).toHaveBeenCalledWith('stored-refresh-token');
    });

    it('goes to unauthenticated (not stuck loading, not a false "error") when the stored token is genuinely invalid (401)', async () => {
      await tokenStorage.saveRefreshToken('stale-refresh-token');
      const unauthorizedError = {
        isAxiosError: true,
        response: { status: 401, data: { success: false, message: 'Invalid or expired refresh token' } },
      };
      mockedAuthApi.refresh.mockRejectedValue(unauthorizedError);

      const { getByTestId } = await renderWithProviders(<Probe />);

      await waitFor(() => {
        expect(getByTestId('probe').props.children).toBe('unauthenticated:none');
      });
      // A genuinely invalid token must be cleared, not left around to retry forever.
      expect(await tokenStorage.getRefreshToken()).toBeNull();
    });

    it('goes to a distinct "error" state — not "unauthenticated" — when the server is unreachable, and keeps the stored token for a later retry', async () => {
      await tokenStorage.saveRefreshToken('still-valid-refresh-token');
      const offlineError = { isAxiosError: true, response: undefined };
      mockedAuthApi.refresh.mockRejectedValue(offlineError);

      let auth!: ReturnType<typeof useAuth>;
      function Capture() {
        auth = useAuth();
        return <Probe />;
      }

      const { getByTestId } = await renderWithProviders(<Capture />);

      await waitFor(() => {
        expect(getByTestId('probe').props.children).toBe('error:none');
      });
      expect(auth.startupError).toBeTruthy();
      // The stored token must survive a network failure — it might still be
      // perfectly valid once connectivity returns.
      expect(await tokenStorage.getRefreshToken()).toBe('still-valid-refresh-token');

      // retryStartup() re-attempts the exact same restore, and recovers once
      // the server responds successfully.
      mockedAuthApi.refresh.mockResolvedValue(authResult);
      await act(async () => {
        auth.retryStartup();
      });

      await waitFor(() => {
        expect(getByTestId('probe').props.children).toBe('authenticated:ada@admill.test');
      });
    });
  });
});
