import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { useUnreadNotificationCount } from '../../../src/hooks/useUnreadNotificationCount';

jest.mock('../../../src/hooks/useSocketEvent', () => ({
  useSocketEvent: () => {},
}));

describe('useUnreadNotificationCount', () => {
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

  it('reads meta.total from a limit:1 isRead=false request as the unread count', async () => {
    mock.onGet('/notifications').reply((config) => {
      expect(config.params).toEqual({ isRead: 'false', limit: 1 });
      return [200, { success: true, data: [], meta: { page: 1, limit: 1, total: 3 } }];
    });

    const { result } = await renderHook(() => useUnreadNotificationCount(), { wrapper });
    await waitFor(() => expect(result.current).toBe(3));
  });
});
