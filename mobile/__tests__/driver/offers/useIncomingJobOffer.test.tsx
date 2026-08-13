import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notifyManager } from '@tanstack/query-core';
import { useIncomingJobOffer } from '../../../src/features/driver/offers/useIncomingJobOffer';

// React Query defers cache-change notifications through its internal
// `scheduleFn` (systemSetTimeoutZero, i.e. a real setTimeout(fn, 0)) before
// they ever reach notifyFn/batchNotifyFn — a genuine standalone timer never
// wrapped in any act() scope by default (no unstable_batchedUpdates to hook
// into outside ReactDOM). Forcing fully synchronous scheduling/notification
// is the standard, documented fix for testing React Query in React Native.
// The other necessary half (see every `await act(...)` below): this
// package's own `act()` (dist/act.js) always wraps its callback in an async
// function internally, even for a synchronous callback — an un-awaited
// `act(() => {...})` here is therefore secretly async, and React logs
// "overlapping act() calls" / "testing environment is not configured to
// support act(...)" and can leave the global act-environment flag corrupted
// for whichever test runs next. Both fixes were required together; either
// alone still left the four QA-audit-finding-#4 tests below flaky/failing.
notifyManager.setScheduler((callback) => callback());
notifyManager.setBatchNotifyFunction((callback) => callback());

const socketHandlers: Record<string, (payload: unknown) => void> = {};
jest.mock('../../../src/hooks/useSocketEvent', () => ({
  useSocketEvent: (event: string, handler: (payload: unknown) => void) => {
    socketHandlers[event] = handler;
  },
}));

// The hook's driver-ID lookup is a real useQuery(['drivers','me'], getMyDriverProfile)
// now (shares the exact cache entry useProfileStatus's own driver query
// uses) — mocked at the module level here so these tests control resolution
// purely through queryClient.setQueryData, never through HTTP/timer timing.
// That sidesteps any act()/flush ordering subtlety a raw network mock would
// introduce, and matches how React Query itself is meant to be driven in
// tests: through the cache, not through the transport underneath it.
jest.mock('../../../src/api/drivers.api', () => ({
  getMyDriverProfile: jest.fn(() => new Promise(() => {})), // never resolves on its own
}));

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    offeredDriverIds: ['my-driver-id'],
    serviceType: 'CAR_TOWING',
    status: 'PENDING',
    pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'Burj Khalifa' },
    destinationLocation: { geo: { type: 'Point', coordinates: [55.14, 25.08] }, address: 'Marina' },
    distanceKm: 12,
    durationMinutes: 20,
    estimatedFare: 80,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    ...overrides,
  };
}

function makeQueryClient() {
  // gcTime: 0 — the mocked getMyDriverProfile() never resolves on its own in
  // several tests below; without forcing immediate garbage collection, each
  // QueryClient's now-permanently-pending query (and its internal timers/
  // observers) would otherwise live for the default 5 minutes, well past
  // this test file's own lifetime.
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

describe('useIncomingJobOffer', () => {
  beforeEach(() => {
    Object.keys(socketHandlers).forEach((key) => delete socketHandlers[key]);
  });

  afterEach(async () => {
    await cleanup();
  });

  function wrapperFor(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it('shows the offer when my own driver id is in offeredDriverIds', async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(['drivers', 'me'], { _id: 'my-driver-id' });

    const { result } = await renderHook(() => useIncomingJobOffer(), { wrapper: wrapperFor(queryClient) });
    await waitFor(() => expect(socketHandlers['job:new-request']).toBeDefined());

    socketHandlers['job:new-request'](jobPayload());

    await waitFor(() => expect(result.current.offer).not.toBeNull());
    expect(result.current.offer?._id).toBe('j1');
  });

  it('ignores a job:new-request not actually offered to this driver (fleet-room broadcast filtering)', async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(['drivers', 'me'], { _id: 'my-driver-id' });

    const { result } = await renderHook(() => useIncomingJobOffer(), { wrapper: wrapperFor(queryClient) });
    await waitFor(() => expect(socketHandlers['job:new-request']).toBeDefined());

    socketHandlers['job:new-request'](jobPayload({ offeredDriverIds: ['someone-else'] }));

    // Give any accidental async state update a chance to happen before asserting.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
    expect(result.current.offer).toBeNull();
  });

  it('dismiss() clears the current offer', async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(['drivers', 'me'], { _id: 'my-driver-id' });

    const { result } = await renderHook(() => useIncomingJobOffer(), { wrapper: wrapperFor(queryClient) });
    await waitFor(() => expect(socketHandlers['job:new-request']).toBeDefined());

    socketHandlers['job:new-request'](jobPayload());
    await waitFor(() => expect(result.current.offer).not.toBeNull());

    result.current.dismiss();
    await waitFor(() => expect(result.current.offer).toBeNull());
  });

  describe('QA audit finding #4 — the launch-time race', () => {
    it('does not lose an offer that arrives before the driver ID has resolved — buffers it and surfaces it once the ID is known', async () => {
      const queryClient = makeQueryClient(); // deliberately no ['drivers','me'] seeded yet

      const { result } = await renderHook(() => useIncomingJobOffer(), { wrapper: wrapperFor(queryClient) });
      await waitFor(() => expect(socketHandlers['job:new-request']).toBeDefined());

      // The event genuinely arrives — the listener is registered — but the
      // driver's own ID hasn't resolved yet. This must NOT be silently
      // dropped the way it was before this fix.
      await act(() => {
        socketHandlers['job:new-request'](jobPayload());
      });
      expect(result.current.offer).toBeNull(); // not yet surfaced — ID still unknown

      // The driver-profile query now resolves (in production: the real
      // GET /drivers/me finally returns).
      await act(() => {
        queryClient.setQueryData(['drivers', 'me'], { _id: 'my-driver-id' });
      });

      await waitFor(() => expect(result.current.offer).not.toBeNull());
      expect(result.current.offer?._id).toBe('j1');
    });

    it('does not surface a buffered offer that was never actually for this driver, once the ID resolves', async () => {
      const queryClient = makeQueryClient();

      const { result } = await renderHook(() => useIncomingJobOffer(), { wrapper: wrapperFor(queryClient) });
      await waitFor(() => expect(socketHandlers['job:new-request']).toBeDefined());

      await act(() => {
        socketHandlers['job:new-request'](jobPayload({ offeredDriverIds: ['someone-else'] }));
      });
      expect(result.current.offer).toBeNull();

      await act(() => {
        queryClient.setQueryData(['drivers', 'me'], { _id: 'my-driver-id' });
      });

      // Give any accidental async state update a chance to happen before asserting.
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
      expect(result.current.offer).toBeNull();
    });

    it('does not re-surface a job already shown once, on a duplicate job:new-request for the same job', async () => {
      const queryClient = makeQueryClient();
      queryClient.setQueryData(['drivers', 'me'], { _id: 'my-driver-id' });

      const { result } = await renderHook(() => useIncomingJobOffer(), { wrapper: wrapperFor(queryClient) });
      await waitFor(() => expect(socketHandlers['job:new-request']).toBeDefined());

      socketHandlers['job:new-request'](jobPayload());
      await waitFor(() => expect(result.current.offer).not.toBeNull());

      result.current.dismiss();
      await waitFor(() => expect(result.current.offer).toBeNull());

      // A duplicate/retried delivery of the identical job must not reopen it.
      socketHandlers['job:new-request'](jobPayload());
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
      expect(result.current.offer).toBeNull();
    });

    it('starts with clean state on a fresh mount — nothing leaks across a logout/login (or reconnect) boundary', async () => {
      const firstQueryClient = makeQueryClient();
      firstQueryClient.setQueryData(['drivers', 'me'], { _id: 'my-driver-id' });

      // First "session": an offer arrives and is shown.
      const first = await renderHook(() => useIncomingJobOffer(), { wrapper: wrapperFor(firstQueryClient) });
      await waitFor(() => expect(socketHandlers['job:new-request']).toBeDefined());
      socketHandlers['job:new-request'](jobPayload());
      await waitFor(() => expect(first.result.current.offer).not.toBeNull());
      first.unmount();

      // A brand new instance (as happens when DriverNavigator remounts after
      // a fresh login, or after a bare socket reconnect with no new event)
      // must not resurrect the previous session's offer or dedup state —
      // the backend never replays missed events (no connectionStateRecovery
      // configured), so nothing should appear without a real new event.
      Object.keys(socketHandlers).forEach((key) => delete socketHandlers[key]);
      const secondQueryClient = makeQueryClient();
      secondQueryClient.setQueryData(['drivers', 'me'], { _id: 'my-driver-id' });
      const second = await renderHook(() => useIncomingJobOffer(), { wrapper: wrapperFor(secondQueryClient) });
      await waitFor(() => expect(socketHandlers['job:new-request']).toBeDefined());
      expect(second.result.current.offer).toBeNull();

      // And the same job._id genuinely re-offered in the new session (a
      // legitimate case, e.g. re-broadcast after the first driver's offer
      // window lapsed) is correctly shown — dedup is per-session, not global.
      socketHandlers['job:new-request'](jobPayload());
      await waitFor(() => expect(second.result.current.offer).not.toBeNull());
    });
  });
});
