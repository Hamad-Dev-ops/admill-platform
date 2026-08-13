import { io, type Socket } from 'socket.io-client';
import { env } from '../config/env';
import type { GeoPoint } from '../types/api';

// frontend-docs/SOCKET-CONTRACT.md — exact event/payload set, verified
// against the backend source in Phase 0. Do not add events here that aren't
// in that doc.

export interface JobPayload {
  _id: string;
  status: string;
  [key: string]: unknown;
}

export interface DriverLocationChangedPayload {
  driverId: string;
  jobId?: string;
  location: GeoPoint;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: string;
}

export interface NotificationPayload {
  _id: string;
  title: string;
  message: string;
  type: string;
  [key: string]: unknown;
}

export interface DriverLocationUpdatePayload {
  location: GeoPoint;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp?: string;
}

interface ServerToClientEvents {
  'job:new-request': (job: JobPayload) => void;
  'job:accepted': (job: JobPayload) => void;
  'job:status-changed': (job: JobPayload) => void;
  'job:subscribed': (jobId: string) => void;
  'driver:location:changed': (payload: DriverLocationChangedPayload) => void;
  'notification:new': (notification: NotificationPayload) => void;
}

interface ClientToServerEvents {
  'job:subscribe': (jobId: string) => void;
  'driver:location:update': (payload: DriverLocationUpdatePayload) => void;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// One singleton connection for the whole app (architecture-baseline.md §5.5)
// — screens subscribe via useSocketEvent, never call io() themselves.
class SocketServiceImpl {
  private socket: AppSocket | null = null;

  connect(accessToken: string): void {
    // Reuse the existing Socket object when one already exists, rather than
    // always constructing a brand-new io(...) instance — a new instance has
    // a brand-new, empty EventEmitter, which silently orphans every
    // listener already registered via .on() (every useSocketEvent consumer,
    // e.g. useIncomingJobOffer's job:new-request handler). That used to
    // happen on every mid-session reconnect (a 401 anywhere triggers
    // AuthContext's refreshSession -> SocketService.reconnect), with no way
    // to recover short of a full app restart — a real bug, not just a
    // theoretical one. socket.io-client's own supported pattern for
    // re-authenticating with new credentials is exactly this: update
    // `auth`, then reconnect the same instance; listeners live on the
    // Socket object itself, not on the underlying transport, so they
    // survive this untouched. A brand-new instance is only ever created
    // once per session (the first connect after login, or after an
    // explicit disconnect() on logout below) — never mid-session.
    if (this.socket) {
      this.socket.auth = { token: accessToken };
      if (this.socket.connected) {
        this.socket.disconnect();
      }
      this.socket.connect();
      return;
    }

    this.socket = io(env.SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    // Nulled out only here (an explicit logout), not on every reconnect —
    // this is what makes the NEXT connect() (a genuinely new session,
    // possibly a different account on the same device) correctly start from
    // a clean, listener-free instance rather than reusing one that may
    // still be holding onto handlers from screens the previous account had
    // mounted (which should have already unregistered via useSocketEvent's
    // own cleanup as they unmounted — this is just defense in depth).
    this.socket = null;
  }

  reconnect(accessToken: string): void {
    this.connect(accessToken);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  subscribeToJob(jobId: string): void {
    this.socket?.emit('job:subscribe', jobId);
  }

  sendLocationUpdate(payload: DriverLocationUpdatePayload): void {
    this.socket?.emit('driver:location:update', payload);
  }

  on<Event extends keyof ServerToClientEvents>(
    event: Event,
    handler: ServerToClientEvents[Event],
  ): void {
    this.socket?.on(event, handler as never);
  }

  off<Event extends keyof ServerToClientEvents>(
    event: Event,
    handler: ServerToClientEvents[Event],
  ): void {
    this.socket?.off(event, handler as never);
  }
}

export const SocketService = new SocketServiceImpl();
export type { ServerToClientEvents };
