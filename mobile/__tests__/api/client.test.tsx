import MockAdapter from 'axios-mock-adapter';
import {
  apiClient,
  configureApiClient,
  getApiErrorMessage,
  isOfflineError,
  isUnauthorizedError,
} from '../../src/api/client';

describe('apiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.restore();
  });

  it('attaches the Authorization header from the configured access token', async () => {
    configureApiClient({
      getAccessToken: () => 'test-access-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });

    mock.onGet('/jobs').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer test-access-token');
      return [200, { success: true, data: [] }];
    });

    await apiClient.get('/jobs');
  });

  it('retries exactly once after a successful silent refresh on 401', async () => {
    const refreshSession = jest.fn().mockResolvedValue('new-access-token');
    const onAuthExpired = jest.fn();
    let callCount = 0;

    configureApiClient({
      getAccessToken: () => (callCount === 0 ? 'expired-token' : 'new-access-token'),
      refreshSession,
      onAuthExpired,
    });

    mock.onGet('/jobs').reply(() => {
      callCount += 1;
      if (callCount === 1) return [401, { success: false, message: 'Invalid or expired access token' }];
      return [200, { success: true, data: [] }];
    });

    const response = await apiClient.get('/jobs');

    expect(response.status).toBe(200);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onAuthExpired).not.toHaveBeenCalled();
  });

  it('clears the session and rejects when refresh itself fails', async () => {
    const refreshSession = jest.fn().mockResolvedValue(null);
    const onAuthExpired = jest.fn();

    configureApiClient({
      getAccessToken: () => 'expired-token',
      refreshSession,
      onAuthExpired,
    });

    mock.onGet('/jobs').reply(401, { success: false, message: 'Invalid or expired access token' });

    await expect(apiClient.get('/jobs')).rejects.toBeTruthy();
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });

  it('does not attempt a refresh loop for auth endpoints themselves', async () => {
    const refreshSession = jest.fn();
    configureApiClient({
      getAccessToken: () => null,
      refreshSession,
      onAuthExpired: jest.fn(),
    });

    mock.onPost('/auth/login').reply(401, { success: false, message: 'Invalid email or password' });

    await expect(apiClient.post('/auth/login', {})).rejects.toBeTruthy();
    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe('getApiErrorMessage', () => {
  it('extracts the backend message from an axios error response', () => {
    const error = {
      isAxiosError: true,
      response: { data: { success: false, message: 'Invalid email or password' } },
    };
    expect(getApiErrorMessage(error)).toBe('Invalid email or password');
  });

  it('falls back to the default message for a non-axios error', () => {
    expect(getApiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
  });

  it('reports a specific offline message when the request never got a response', () => {
    const error = { isAxiosError: true, response: undefined };
    expect(getApiErrorMessage(error, 'fallback')).toBe(
      'No internet connection. Check your network and try again.',
    );
  });
});

describe('isOfflineError', () => {
  it('is true for an axios error with no response', () => {
    expect(isOfflineError({ isAxiosError: true, response: undefined })).toBe(true);
  });

  it('is false for an axios error with a response', () => {
    expect(isOfflineError({ isAxiosError: true, response: { status: 500 } })).toBe(false);
  });

  it('is false for a non-axios error', () => {
    expect(isOfflineError(new Error('boom'))).toBe(false);
  });
});

describe('isUnauthorizedError', () => {
  it('is true for an axios error with a 401 response', () => {
    expect(isUnauthorizedError({ isAxiosError: true, response: { status: 401 } })).toBe(true);
  });

  it('is false for an axios error with a different status', () => {
    expect(isUnauthorizedError({ isAxiosError: true, response: { status: 403 } })).toBe(false);
  });

  it('is false for an axios error with no response (offline)', () => {
    expect(isUnauthorizedError({ isAxiosError: true, response: undefined })).toBe(false);
  });

  it('is false for a non-axios error', () => {
    expect(isUnauthorizedError(new Error('boom'))).toBe(false);
  });
});
