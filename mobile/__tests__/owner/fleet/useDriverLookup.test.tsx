import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { useDriverLookup } from '../../../src/features/owner/shared/useDriverLookup';

describe('useDriverLookup', () => {
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

  it('falls back to employeeId since GET /drivers (list) never populates userId', async () => {
    mock.onGet('/drivers').reply(200, {
      success: true,
      data: [
        { _id: 'd1', employeeId: 'DRV-000001', userId: 'user-1', status: 'AVAILABLE' },
      ],
      meta: { page: 1, limit: 100, total: 1 },
    });

    const { result } = await renderHook(() => useDriverLookup(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getDriverLabel('d1')).toBe('DRV-000001');
  });

  it('returns Unassigned for no id and Unknown driver for an unresolved id', async () => {
    mock.onGet('/drivers').reply(200, {
      success: true,
      data: [],
      meta: { page: 1, limit: 100, total: 0 },
    });

    const { result } = await renderHook(() => useDriverLookup(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getDriverLabel(undefined)).toBe('Unassigned');
    expect(result.current.getDriverLabel('missing-id')).toBe('Unknown driver');
  });
});
