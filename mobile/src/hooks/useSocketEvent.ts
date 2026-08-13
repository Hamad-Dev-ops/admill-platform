import { useEffect, useRef } from 'react';
import { SocketService, type ServerToClientEvents } from '../socket/SocketService';

// Declarative subscription so screens never touch the raw socket instance
// (architecture-baseline.md §5.5).
//
// Latest-ref pattern (Performance Audit finding F1): `handler` is almost
// always a fresh inline closure from the caller, recreated every render. If
// it were a useEffect dependency directly (as it used to be), every render
// would tear down and re-subscribe from SocketService — cheap per call, but
// churns continuously on any component that re-renders often (the worst
// case found: CustomerJobDetailScreen's driver:location:changed listener,
// torn down and rebuilt on every ~4s GPS tick during an active job, along
// with every other useSocketEvent call in that same component). Keeping the
// latest handler in a ref, updated on every render, and depending only on
// `event` means the actual SocketService.on/off pair only runs on
// mount/unmount or when the event name itself changes. Behavior is
// unchanged — the latest handler is always the one invoked — only the
// subscribe/unsubscribe churn is eliminated. Fixing it here, once, means
// none of the ~13 existing call sites need to change individually.
export function useSocketEvent<Event extends keyof ServerToClientEvents>(
  event: Event,
  handler: ServerToClientEvents[Event],
): void {
  // Safe to mutate during render (not read for this render's own output) —
  // the standard "always call the latest closure" ref pattern.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stableHandler = ((...args: unknown[]) => {
      (handlerRef.current as (...eventArgs: unknown[]) => void)(...args);
    }) as ServerToClientEvents[Event];

    SocketService.on(event, stableHandler);
    return () => {
      SocketService.off(event, stableHandler);
    };
    // handlerRef.current is always up to date by the time this effect (or
    // any later invocation of stableHandler) runs — only `event` should
    // ever cause a real resubscribe.
  }, [event]);
}
