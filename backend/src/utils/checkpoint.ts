import { logger } from "./logger";

/** Stable event names for grep-friendly debugging (`checkpoint` field in every log). */
export const Checkpoint = {
  HTTP_REQUEST: "http.request",
  HTTP_SLOW: "http.slow",
  HTTP_CLIENT_ERROR: "http.client_error",
  HTTP_SERVER_ERROR: "http.server_error",
  DB_CONNECTED: "db.connected",
  DB_DISCONNECTED: "db.disconnected",
  SERVER_READY: "server.ready",
  HEALTH_CHECK: "health.check",
  SOCKET_CONNECT: "socket.connect",
  SOCKET_AUTH_FAIL: "socket.auth_fail",
  SOCKET_DISCONNECT: "socket.disconnect",
  SOCKET_FLEET_JOIN: "socket.fleet_join",
  SOCKET_FLEET_JOIN_FAIL: "socket.fleet_join_fail",
  SOCKET_JOB_SUBSCRIBE: "socket.job_subscribe",
  SOCKET_JOB_SUBSCRIBE_REJECT: "socket.job_subscribe_reject",
  AUTH_LOGIN_SUCCESS: "auth.login_success",
  AUTH_LOGIN_FAILURE: "auth.login_failure",
  PRICING_ESTIMATE_RECEIVED: "pricing.estimate_received",
  PRICING_ESTIMATE_SUCCESS: "pricing.estimate_success",
  PRICING_ESTIMATE_FAILURE: "pricing.estimate_failure",
  JOB_CREATE_RECEIVED: "job.create_received",
  JOB_CUSTOMER_RESOLVED: "job.customer_resolved",
  JOB_COMPANY_RESOLVED: "job.company_resolved",
  JOB_COMPANY_RESOLUTION_FAILED: "job.company_resolution_failed",
  JOB_PRICING_COMPLETE: "job.pricing_complete",
  JOB_DRIVER_SEARCH_START: "job.driver_search_start",
  JOB_DRIVER_SEARCH_RESULT: "job.driver_search_result",
  JOB_CREATED: "job.created",
  JOB_OFFER_EMIT_START: "job.offer_emit_start",
  JOB_OFFER_EMIT_SUCCESS: "job.offer_emit_success",
  JOB_DRIVER_ACCEPT_RECEIVED: "job.driver_accept_received",
  JOB_DRIVER_ACCEPT_SUCCESS: "job.driver_accept_success",
  JOB_DRIVER_ACCEPT_REJECT: "job.driver_accept_reject",
  TRACKING_LOCATION_RECEIVED: "tracking.location_received",
  TRACKING_LOCATION_REJECT: "tracking.location_reject",
  TRACKING_LOCATION_SAVED: "tracking.location_saved",
  TRACKING_LOCATION_READ: "tracking.location_read",
  DRIVER_STATUS_CHANGED: "driver.status_changed",
  JOB_STATUS_CHANGED: "job.status_changed",
} as const;

export type CheckpointEvent = (typeof Checkpoint)[keyof typeof Checkpoint];

type LogLevel = "info" | "warn" | "debug" | "error";

/** Rounded coords for logs — enough for debugging without full precision. */
export function locationSnapshot(coordinates: [number, number]): { lat: number; lng: number } {
  return {
    lat: Math.round(coordinates[1] * 10_000) / 10_000,
    lng: Math.round(coordinates[0] * 10_000) / 10_000,
  };
}

export function logCheckpoint(
  event: CheckpointEvent,
  context: Record<string, unknown> = {},
  level: LogLevel = "info"
): void {
  logger[level]({ checkpoint: event, ...context }, event);
}
