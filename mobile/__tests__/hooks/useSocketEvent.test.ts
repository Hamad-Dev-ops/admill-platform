import { renderHook } from '@testing-library/react-native';
import { useSocketEvent } from '../../src/hooks/useSocketEvent';
import { SocketService } from '../../src/socket/SocketService';

jest.mock('../../src/socket/SocketService', () => ({
  SocketService: { on: jest.fn(), off: jest.fn() },
}));

const mockOn = SocketService.on as jest.Mock;
const mockOff = SocketService.off as jest.Mock;

describe('useSocketEvent', () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockOff.mockClear();
  });

  // The actual bug (Performance Audit finding F1): a fresh inline handler on
  // every render used to tear down and re-subscribe from SocketService on
  // every render of the calling component — cheap per call, but real churn
  // on a component re-rendering often (e.g. every ~4s during GPS tracking).
  it('does not resubscribe when only the handler reference changes across re-renders', async () => {
    const handler1 = jest.fn();
    const { rerender } = await renderHook(
      ({ handler }: { handler: jest.Mock }) => useSocketEvent('job:accepted', handler),
      { initialProps: { handler: handler1 } },
    );

    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockOff).not.toHaveBeenCalled();

    const handler2 = jest.fn();
    await rerender({ handler: handler2 });
    await rerender({ handler: jest.fn() });
    await rerender({ handler: jest.fn() });

    // Still exactly one subscribe — no resubscription happened for any of
    // the 3 re-renders above, each with a brand-new handler reference.
    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockOff).not.toHaveBeenCalled();
  });

  it('always invokes the latest handler, even though the SocketService subscription itself never changed', async () => {
    const handler1 = jest.fn();
    const { rerender } = await renderHook(
      ({ handler }: { handler: jest.Mock }) => useSocketEvent('job:accepted', handler),
      { initialProps: { handler: handler1 } },
    );

    // The stable wrapper function SocketService.on was actually called with.
    const stableWrapper = mockOn.mock.calls[0][1] as (job: unknown) => void;

    const handler2 = jest.fn();
    await rerender({ handler: handler2 });

    const payload = { _id: 'j1' };
    stableWrapper(payload);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledWith(payload);
  });

  it('resubscribes when the event name itself changes', async () => {
    const handler = jest.fn();
    const { rerender } = await renderHook(
      ({ event }: { event: 'job:accepted' | 'job:status-changed' }) => useSocketEvent(event, handler),
      { initialProps: { event: 'job:accepted' } },
    );

    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockOn.mock.calls[0][0]).toBe('job:accepted');

    await rerender({ event: 'job:status-changed' as const });

    expect(mockOff).toHaveBeenCalledTimes(1);
    expect(mockOff.mock.calls[0][0]).toBe('job:accepted');
    expect(mockOn).toHaveBeenCalledTimes(2);
    expect(mockOn.mock.calls[1][0]).toBe('job:status-changed');
  });

  it('unsubscribes on unmount', async () => {
    const handler = jest.fn();
    const { unmount } = await renderHook(() => useSocketEvent('job:accepted', handler));

    expect(mockOff).not.toHaveBeenCalled();
    await unmount();
    expect(mockOff).toHaveBeenCalledTimes(1);
  });
});
