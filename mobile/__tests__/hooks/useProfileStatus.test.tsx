import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../src/api/client';
import { useProfileStatus } from '../../src/hooks/useProfileStatus';

const mockUseAuth = jest.fn();
jest.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function authedUser(role: 'OWNER' | 'DRIVER' | 'CUSTOMER') {
  return { id: 'u1', firstName: 'F', lastName: 'L', email: 'f@x.com', phone: '1', role };
}

describe('useProfileStatus', () => {
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

  function wrapper({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('reports loading while there is no user yet', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = await renderHook(() => useProfileStatus(), { wrapper });
    expect(result.current.kind).toBe('loading');
  });

  describe('OWNER', () => {
    beforeEach(() => mockUseAuth.mockReturnValue({ user: authedUser('OWNER') }));

    it('resolves to no-profile on a genuine 404 (never registered a company)', async () => {
      mock.onGet('/companies/me').reply(404, { success: false, message: 'Not found' });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('no-profile');
    });

    it('resolves to ready when a company exists', async () => {
      mock.onGet('/companies/me').reply(200, { success: true, data: { _id: 'c1', companyName: 'Admill' } });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('ready');
    });

    it('resolves to error (not no-profile) on a network failure', async () => {
      mock.onGet('/companies/me').networkError();
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('error');
    });

    it('resolves to error (not no-profile) on a backend 500', async () => {
      mock.onGet('/companies/me').reply(500, { success: false, message: 'Internal error' });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('error');
    });

    it('recovers to ready after retry() once the backend responds successfully', async () => {
      let attempt = 0;
      mock.onGet('/companies/me').reply(() => {
        attempt += 1;
        if (attempt === 1) return [500, { success: false, message: 'Internal error' }];
        return [200, { success: true, data: { _id: 'c1', companyName: 'Admill' } }];
      });

      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).toBe('error'));

      await act(async () => {
        if (result.current.kind === 'error') {
          await result.current.retry();
        }
      });

      await waitFor(() => expect(result.current.kind).toBe('ready'));
      expect(attempt).toBe(2);
    });
  });

  describe('DRIVER', () => {
    beforeEach(() => mockUseAuth.mockReturnValue({ user: authedUser('DRIVER') }));

    it('resolves to no-profile on a genuine 404 (never registered as a driver)', async () => {
      mock.onGet('/drivers/me').reply(404, { success: false, message: 'Not found' });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('no-profile');
    });

    it('resolves to pending-approval for an unapproved driver', async () => {
      mock.onGet('/drivers/me').reply(200, { success: true, data: { _id: 'd1', approvalStatus: 'PENDING_APPROVAL' } });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('pending-approval');
    });

    it('resolves to rejected for a rejected driver', async () => {
      mock.onGet('/drivers/me').reply(200, { success: true, data: { _id: 'd1', approvalStatus: 'REJECTED' } });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('rejected');
    });

    it('resolves to ready for an approved driver', async () => {
      mock.onGet('/drivers/me').reply(200, { success: true, data: { _id: 'd1', approvalStatus: 'APPROVED' } });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('ready');
    });

    it('resolves to error (not no-profile) on a network failure, even for an already-approved driver', async () => {
      mock.onGet('/drivers/me').networkError();
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('error');
    });
  });

  describe('CUSTOMER', () => {
    beforeEach(() => mockUseAuth.mockReturnValue({ user: authedUser('CUSTOMER') }));

    it('resolves to no-profile on a genuine 404', async () => {
      mock.onGet('/customers/me').reply(404, { success: false, message: 'Not found' });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('no-profile');
    });

    it('resolves to ready when a customer profile exists', async () => {
      mock.onGet('/customers/me').reply(200, { success: true, data: { _id: 'cus1', customerCode: 'CUS-1' } });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('ready');
    });

    it('resolves to error (not no-profile) on a backend 500', async () => {
      mock.onGet('/customers/me').reply(500, { success: false, message: 'Internal error' });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).not.toBe('loading'));
      expect(result.current.kind).toBe('error');
    });
  });

  describe('query isolation between roles', () => {
    it('an OWNER session never calls /drivers/me or /customers/me', async () => {
      mockUseAuth.mockReturnValue({ user: authedUser('OWNER') });
      mock.onGet('/companies/me').reply(200, { success: true, data: { _id: 'c1' } });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).toBe('ready'));

      const calledPaths = mock.history.get.map((r) => r.url);
      expect(calledPaths).toContain('/companies/me');
      expect(calledPaths).not.toContain('/drivers/me');
      expect(calledPaths).not.toContain('/customers/me');
    });

    it('a DRIVER session never calls /companies/me or /customers/me', async () => {
      mockUseAuth.mockReturnValue({ user: authedUser('DRIVER') });
      mock.onGet('/drivers/me').reply(200, { success: true, data: { _id: 'd1', approvalStatus: 'APPROVED' } });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).toBe('ready'));

      const calledPaths = mock.history.get.map((r) => r.url);
      expect(calledPaths).toContain('/drivers/me');
      expect(calledPaths).not.toContain('/companies/me');
      expect(calledPaths).not.toContain('/customers/me');
    });

    it('a CUSTOMER session never calls /companies/me or /drivers/me', async () => {
      mockUseAuth.mockReturnValue({ user: authedUser('CUSTOMER') });
      mock.onGet('/customers/me').reply(200, { success: true, data: { _id: 'cus1' } });
      const { result } = await renderHook(() => useProfileStatus(), { wrapper });
      await waitFor(() => expect(result.current.kind).toBe('ready'));

      const calledPaths = mock.history.get.map((r) => r.url);
      expect(calledPaths).toContain('/customers/me');
      expect(calledPaths).not.toContain('/companies/me');
      expect(calledPaths).not.toContain('/drivers/me');
    });
  });
});
