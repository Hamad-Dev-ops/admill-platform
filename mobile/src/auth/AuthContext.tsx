import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth.api';
import { configureApiClient, getApiErrorMessage, isUnauthorizedError } from '../api/client';
import { initializePushNotifications } from '../notifications/pushRegistration';
import { SocketService } from '../socket/SocketService';
import { clearRefreshToken, getRefreshToken, saveRefreshToken } from './tokenStorage';
import type { AuthUser } from '../types/entities';

// 'error' — a stored session exists but couldn't be validated because the
// network/server was unreachable at launch. Deliberately distinct from
// 'unauthenticated' (a genuinely expired/invalid session): collapsing the
// two would mean a dropped connection silently signs the user out of an
// otherwise-valid session on every cold start until the network happens to
// be up — the same "don't collapse failure states" bug issue #2 fixed for
// useProfileStatus, applying here to the one startup path that fix doesn't
// cover.
type SessionStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

interface AuthContextValue {
  status: SessionStatus;
  user: AuthUser | null;
  startupError: string | null;
  retryStartup: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: authApi.RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// A stored refresh token being unreadable (a real Keychain/Keystore failure
// — confirmed the actual cause of "app doesn't reopen after being
// backgrounded, needs reinstall": this used to be awaited with zero error
// handling anywhere in the launch path, so an exception here left `status`
// stuck at its initial 'loading' value forever, since the code that would
// have called setStatus(...) never ran) must be treated exactly like "no
// token stored" — fail safe to the login screen — never let it hang startup
// forever.
async function readStoredRefreshTokenSafely(): Promise<string | null> {
  try {
    return await getRefreshToken();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  // Access token lives in a ref, not state — the axios interceptor reads it
  // synchronously on every request and doesn't need re-renders.
  const accessTokenRef = useRef<string | null>(null);
  // Guards against re-subscribing FCM's onTokenRefresh/onMessage listeners on
  // every 401-triggered refreshSession call within the same session — push
  // registration follows the same "connect once per session" lifecycle as
  // SocketService, just tracked separately since unlike the socket it has no
  // built-in idempotent reconnect of its own.
  const pushUnsubscribeRef = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();

  const ensurePushRegistered = useCallback(() => {
    if (pushUnsubscribeRef.current) return;
    pushUnsubscribeRef.current = initializePushNotifications();
  }, []);

  const applySession = useCallback(
    async (result: { user: AuthUser; accessToken: string; refreshToken: string }) => {
      accessTokenRef.current = result.accessToken;
      await saveRefreshToken(result.refreshToken);
      setUser(result.user);
      setStartupError(null);
      setStatus('authenticated');
      SocketService.connect(result.accessToken);
      ensurePushRegistered();
    },
    [ensurePushRegistered],
  );

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    await clearRefreshToken().catch(() => {});
    setUser(null);
    setStartupError(null);
    setStatus('unauthenticated');
    SocketService.disconnect();
    pushUnsubscribeRef.current?.();
    pushUnsubscribeRef.current = null;
    // Every cached query (profile, jobs, driver location, vehicle, ...) is
    // scoped by a role-agnostic key (['drivers','me'], ['jobs'], etc.), not
    // by user id — without this, a fast logout-then-different-account-login
    // on the same device could briefly render the previous account's still-
    // warm cached data before a fresh fetch overwrites it. Cheap to do
    // (in-memory only, nothing persisted to disk to worry about).
    queryClient.clear();
  }, [queryClient]);

  // Used by the API client's own 401 interceptor (api/client.ts) to silently
  // re-auth mid-session — must keep this exact Promise<string|null> contract.
  // Every step is individually guarded so this can never throw and leave a
  // caller (the interceptor) hanging on a rejected promise it doesn't await
  // a catch for.
  const refreshSession = useCallback(async (): Promise<string | null> => {
    const storedRefreshToken = await readStoredRefreshTokenSafely();
    if (!storedRefreshToken) return null;

    try {
      const result = await authApi.refresh(storedRefreshToken);
      accessTokenRef.current = result.accessToken;
      await saveRefreshToken(result.refreshToken);
      setUser(result.user);
      SocketService.reconnect(result.accessToken);
      ensurePushRegistered();
      return result.accessToken;
    } catch {
      return null;
    }
  }, [ensurePushRegistered]);

  // Silent restore on app launch/reopen (architecture-baseline.md §5.3).
  // Deliberately doesn't just call refreshSession() above — this path needs
  // to distinguish a genuinely expired/invalid session (-> login screen,
  // stored token cleared) from a network/server problem (-> retryable
  // 'error' state, stored token left untouched so a later retry can still
  // use it). The small duplication with refreshSession is intentional: they
  // answer different questions ("is there still a usable token, right now,
  // for this one request" vs "what should the whole app show at launch").
  const attemptStartup = useCallback(async () => {
    setStatus('loading');
    const storedRefreshToken = await readStoredRefreshTokenSafely();
    if (!storedRefreshToken) {
      setStatus('unauthenticated');
      return;
    }

    try {
      const result = await authApi.refresh(storedRefreshToken);
      accessTokenRef.current = result.accessToken;
      await saveRefreshToken(result.refreshToken);
      setUser(result.user);
      setStartupError(null);
      setStatus('authenticated');
      SocketService.reconnect(result.accessToken);
      ensurePushRegistered();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        // The stored token itself is genuinely invalid/expired — a real
        // "you're logged out", not a transient failure.
        await clearRefreshToken().catch(() => {});
        setStatus('unauthenticated');
      } else {
        // Network/server unavailable, or anything else unexpected — the
        // stored token is left untouched (still possibly valid) and the
        // user gets a retry, not a silent, incorrect logout.
        setStartupError(getApiErrorMessage(error, 'Unable to reach the server'));
        setStatus('error');
      }
    }
  }, [ensurePushRegistered]);

  // Wire the API client's 401 handling to this session exactly once.
  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessTokenRef.current,
      refreshSession,
      onAuthExpired: () => {
        clearSession().catch(() => {});
      },
    });
  }, [refreshSession, clearSession]);

  // attemptStartup is referentially stable (its only dependency,
  // ensurePushRegistered, never changes) — this runs exactly once per app
  // launch, and retryStartup below re-invokes the same function on demand.
  useEffect(() => {
    attemptStartup();
  }, [attemptStartup]);

  const retryStartup = useCallback(() => {
    attemptStartup();
  }, [attemptStartup]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login({ email, password });
      await applySession(result);
    },
    [applySession],
  );

  const register = useCallback(
    async (payload: authApi.RegisterPayload) => {
      const result = await authApi.register(payload);
      await applySession(result);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const storedRefreshToken = await readStoredRefreshTokenSafely();
    try {
      if (storedRefreshToken) {
        await authApi.logout(storedRefreshToken);
      }
    } catch {
      // Backend logout is best-effort — always clear the local session.
    }
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, startupError, retryStartup, login, register, logout }),
    [status, user, startupError, retryStartup, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { getApiErrorMessage };
