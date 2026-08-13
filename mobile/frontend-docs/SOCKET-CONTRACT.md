# Socket.IO Contract (ground truth)

Source: `src/config/socket.ts`, `src/socket/{job,tracking,notification}.socket.ts`, verified by direct source read on 2026-08-09.

## Connection

Single namespace (default `/`), one Socket.IO server shared by all roles.

```ts
import { io } from "socket.io-client";
const socket = io(BASE_URL, { auth: { token: accessToken } });
```

- Token is the **same JWT access token** used for REST bearer auth — verified once at handshake, not per-event. If the access token expires mid-session, the socket does **not** auto-reauth; the RN app must reconnect with a freshly-refreshed token (there's no token-refresh-over-socket mechanism) — treat a socket disconnect due to auth expiry the same way as a 401 on REST: refresh, then reconnect.
- Missing/invalid token at connect time → connection rejected with an auth error (`"Authentication required"` / `"Invalid or expired token"`), not a silent hang.
- On successful connect, the server auto-joins the socket to:
  - `user:<userId>` (everyone)
  - `company:<companyId>:fleet` (DRIVER and OWNER only — resolved server-side from their profile, not client-supplied)

## Server → client events

| Event | Room | Payload | When |
|---|---|---|---|
| `job:new-request` | `company:<companyId>:fleet` | full `IJob` | a new job is created for this company. **Correction (Phase 3 re-verification): this goes to EVERY socket in the company fleet room, not just drivers in `offeredDriverIds`** — the fleet room isn't filtered per-driver at the socket layer (only the separate `JOB_REQUEST` push notification is targeted to `nearbyDrivers`). The Driver client **must** check whether its own driver `_id` is present in the payload's `offeredDriverIds` array before treating this as "an offer for me" — otherwise every online driver in the company would see every job as an offer, including ones not actually offered to them. |
| `job:accepted` | `job:<jobId>` | full `IJob` | a driver successfully accepts |
| `job:status-changed` | `job:<jobId>` | full `IJob` | any status transition via `PATCH .../status` (EN_ROUTE/ARRIVED/STARTED/COMPLETED/CANCELLED) |
| `job:subscribed` | (ack to the requesting socket only) | `jobId` string | server confirms a successful `job:subscribe` |
| `driver:location:changed` | `job:<jobId>` **and** `company:<companyId>:fleet` | `{driverId, jobId?, location:GeoPoint, speed?, heading?, accuracy?, timestamp}` | on every accepted location update (REST or socket) |
| `notification:new` | `user:<receiverId>` | full `INotification` | any in-app notification is created (mirrors what push/FCM also sends, for foreground in-app toasts) |

All server emits are best-effort (`safeEmit` — swallows errors) — a socket emit failing never breaks the underlying REST call that triggered it. Don't build client logic that assumes an event is guaranteed to arrive; REST responses/GETs remain the source of truth on reconnect or missed events.

## Client → server events

| Event | Payload | Server behavior |
|---|---|---|
| `job:subscribe` | `jobId` (string) | Server re-runs the same access check as `GET /jobs/:id` (`assertJobAccess`) before joining the socket to `job:<jobId>`. **Silently no-ops** if unauthorized — no error event fires, the client just never gets `job:subscribed` back. If you don't receive the ack within a short timeout, treat it as "not authorized/not found," not as a slow network. **Driver-specific gotcha (Phase 3 re-verification): `assertJobAccess` for a DRIVER requires `job.driverId === own driver _id` — which is unset until the job is accepted.** A driver **cannot** `job:subscribe` (or `GET /jobs/:id`) for a job it's merely been offered but not yet accepted. Practical effect: the entire "incoming offer" UI must be built from the `job:new-request` payload held in local/query-cache state, not re-fetched by id — only subscribe/fetch by id **after** a successful `POST /jobs/:id/accept`. |
| `driver:location:update` | same shape as `driverPositionUpdateSchema`: `{location:GeoPoint, speed?, heading?, accuracy?, timestamp?}` | Only processed if the connected socket's role is DRIVER and the payload passes Zod validation — **silently dropped** otherwise (no error emitted back). Calls the exact same `TrackingService.updateLocation` as `PATCH /drivers/me/location`. |

There is no `job:unsubscribe` event — rooms are cleaned up on disconnect. If a customer/driver navigates away from a job's tracking screen, either leave the room client-side (`socket.emit` isn't needed — Socket.IO client can `socket.leave` is server-only; practically, just stop reacting to events for that job, or disconnect/reconnect the socket) or accept that the room membership persists until disconnect (harmless — it's a read-only subscription, not a write channel).

## Design-handoff GPS cadence

The design's developer-handoff notes specify a client-side send cadence: **4 seconds while the driver is on an active job, 15 seconds while idle/available**. This is a **client-side interval the RN app must implement itself** — the backend has no rate-limiting or cadence enforcement on `driver:location:update`/`PATCH /drivers/me/location` (any cadence the client sends at is accepted and processed). Note: `TrackingService` does apply its own internal sampling into `LocationHistory` (throttled to ~20s or a 30°+ heading change) independent of how often the client sends live position updates — that throttle only affects what gets persisted to history, not what gets broadcast live via `driver:location:changed`, which re-emits on every accepted update regardless of the client's send interval.

## Practical wiring for admill-mobile

- One shared `SocketService` (singleton), connected once after login with the current access token, reconnected on token refresh.
- CUSTOMER: on entering a job-tracking screen, emit `job:subscribe`; listen for `job:status-changed`, `job:accepted`, `driver:location:changed` (filtered to this job's driver).
- DRIVER: always connected while online (auto-joined to fleet room); listen for `job:new-request` to show incoming offers; while on an active job, run a 4s location-send interval (fallback to `PATCH /drivers/me/location` if the socket happens to be disconnected, since both paths are equivalent); while idle/AVAILABLE, 15s interval.
- OWNER: fleet dashboard listens on the auto-joined `company:<id>:fleet` room for `job:new-request` and `driver:location:changed` across all their drivers, for a live map view.
- Global: any screen showing a bell/notification badge listens for `notification:new` on `user:<id>` for real-time badge updates, in addition to polling `GET /notifications` on screen mount.
