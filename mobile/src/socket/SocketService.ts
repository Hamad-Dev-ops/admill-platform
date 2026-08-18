import { io, type Socket } from 'socket.io-client';
import { env } from '../config/env';
import type { GeoPoint } from '../types/api';
import { flowLog } from '../utils/flowLog';

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

class SocketServiceImpl {
  private socket: AppSocket | null = null;
  private connectListeners = new Set<() => void>();

  addConnectListener(handler: () => void): void {
    this.connectListeners.add(handler);
  }

  removeConnectListener(handler: () => void): void {
    this.connectListeners.delete(handler);
  }

  private notifyConnect(): void {
    this.connectListeners.forEach((handler) => handler());
  }

  connect(accessToken: string): void {
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
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });

    this.socket.on('connect', () => {
      flowLog('socket.client_connect', { socketId: this.socket?.id ?? '' });
      this.notifyConnect();
    });
    this.socket.on('disconnect', (reason) => {
      flowLog('socket.client_disconnect', { reason });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
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
