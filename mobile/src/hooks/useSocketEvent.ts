import { useEffect } from 'react';
import { SocketService, type ServerToClientEvents } from '../socket/SocketService';

// Declarative subscription so screens never touch the raw socket instance
// (architecture-baseline.md §5.5).
export function useSocketEvent<Event extends keyof ServerToClientEvents>(
  event: Event,
  handler: ServerToClientEvents[Event],
): void {
  useEffect(() => {
    SocketService.on(event, handler);
    return () => {
      SocketService.off(event, handler);
    };
  }, [event, handler]);
}
