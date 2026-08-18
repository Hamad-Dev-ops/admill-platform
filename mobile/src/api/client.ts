import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import type { ApiError } from '../types/api';

interface SessionHandlers {
  getAccessToken: () => string | null;
  // Resolves the new access token on success, or null if refresh failed
  // (e.g. the refresh token itself is expired/revoked).
  refreshSession: () => Promise<string | null>;
  onAuthExpired: () => void;
}

// Wired up by AuthProvider on mount (see src/auth/AuthContext.tsx) — kept out
// of this module so the API client has no dependency on React/context and
// can be imported/tested standalone. See architecture-baseline.md §5.4: one
// axios instance, one interceptor, no per-screen refresh logic.
let sessionHandlers: SessionHandlers | null = null;

export function configureApiClient(handlers: SessionHandlers): void {
  sessionHandlers = handlers;
}

export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 15000,
  // ngrok free-tier interstitial (ERR_NGROK_6024) otherwise returns HTML 200
  // instead of the API envelope when the client looks browser-like.
  headers: { 'ngrok-skip-browser-warning': 'true' },
});

apiClient.interceptors.request.use((config) => {
  const token = sessionHandlers?.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    const isUnauthorized = error.response?.status === 401;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');

    if (!isUnauthorized || !originalRequest || originalRequest._retried || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (!sessionHandlers) {
      return Promise.reject(error);
    }

    originalRequest._retried = true;
    const newAccessToken = await sessionHandlers.refreshSession();

    if (!newAccessToken) {
      sessionHandlers.onAuthExpired();
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
    return apiClient(originalRequest);
  },
);

export function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

// A genuinely invalid/expired credential — distinct from a network/server
// failure (isOfflineError below), which must never be treated the same way
// (AuthContext's startup restore relies on this distinction so a dropped
// connection doesn't silently log a user out of an otherwise-valid session).
export function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

// 409 — used across this backend for "lost a real concurrency race"
// (job accept) as well as ordinary conflicts (duplicate profile, etc.).
// Callers that can lose a genuine race (job accept) must treat this as an
// expected outcome, not an unexpected error (JOB-LIFECYCLE.md).
export function isConflictError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409;
}

// 410 — job.service.ts uses this specifically for "this job has expired".
export function isGoneError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 410;
}

export function isForbiddenError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

// Every backend error response is {success:false, message} — a single
// string, not field-keyed (frontend-docs/API-CONTRACT.md). Callers should
// use this instead of poking at error.response.data directly.
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    if (data && data.success === false && data.message) {
      return data.message;
    }
    // No response at all (as opposed to a non-2xx one) means the request
    // never reached the backend — a real offline/no-connectivity state, not
    // a generic failure. Worth a distinct message since "Something went
    // wrong" reads as a bug report when it's actually just no signal.
    if (!error.response) {
      return 'No internet connection. Check your network and try again.';
    }
  }
  return fallback;
}

export function isOfflineError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}
