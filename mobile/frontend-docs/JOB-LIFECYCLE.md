# Job Lifecycle (state machine ground truth)

Source: `src/modules/job/job.state-machine.ts` + `job.service.ts` (via audit agent read of live source, 2026-08-09).

## States

```
PENDING → ACCEPTED → EN_ROUTE → ARRIVED → STARTED → COMPLETED
   ↓          ↓          ↓          ↓         ↓
CANCELLED  CANCELLED  CANCELLED  CANCELLED  CANCELLED
   ↓
EXPIRED
```

- `COMPLETED`, `CANCELLED`, `EXPIRED` are **terminal** — no transition out of them exists; the server 400s any attempt.
- `PENDING → ACCEPTED` only happens via `POST /jobs/:id/accept`, never via `PATCH /jobs/:id/status` (that endpoint rejects `ACCEPTED` as a manual target).
- `PENDING → EXPIRED` is **lazy**, not a cron/scheduled job: a PENDING job whose `expiresAt` (created-at + 10 minutes) has passed flips to EXPIRED the next time *anything* reads/accepts/rejects it. A job can sit in Mongo showing `status: PENDING` past its expiry until the next read — don't treat "not yet flipped" as "still acceptable," always trust `expiresAt` client-side for display/enable-disable logic too.

## Who can trigger each transition

| Transition | Endpoint | Who |
|---|---|---|
| create → PENDING | `POST /jobs` | CUSTOMER (with a Customer profile) |
| PENDING → ACCEPTED | `POST /jobs/:id/accept` | DRIVER, only if in `offeredDriverIds`, own company, APPROVED, currently AVAILABLE, job not expired |
| PENDING → PENDING (reject, no state change) | `POST /jobs/:id/reject` | DRIVER, same eligibility as accept minus the AVAILABLE requirement |
| ACCEPTED → EN_ROUTE | `PATCH /jobs/:id/status {status:"EN_ROUTE"}` | the assigned DRIVER only |
| EN_ROUTE → ARRIVED | `PATCH .../status {status:"ARRIVED"}` | assigned DRIVER only |
| ARRIVED → STARTED | `PATCH .../status {status:"STARTED"}` | assigned DRIVER only — sets `startedAt` |
| STARTED → COMPLETED | `PATCH .../status {status:"COMPLETED"}` | assigned DRIVER only — sets `completedAt`, `finalFare = estimatedFare` (no recompute against actual route driven — this is a known simplification, not a bug) |
| any non-terminal → CANCELLED | `PATCH .../status {status:"CANCELLED", cancellationReason}` | **anyone who can view the job** — customer, assigned driver, or owning OWNER. `cancellationReason` is required (Zod `.refine()`) |
| PENDING → EXPIRED | (lazy, no explicit call) | system, on next read past `expiresAt` |

## Side effects per transition (for building the right UI reactions)

- **Job created**: pricing engine runs synchronously (fare/distance/duration set immediately in the create response — no "pending calculation" state to poll for). 2dsphere query snapshots nearby available drivers into `offeredDriverIds` **once, at creation** — a driver going online nearby a minute later is never added to this job's offer list. Socket `job:new-request` → company fleet room; `JOB_REQUEST` notification → every offered driver.
- **Accepted**: race-safe atomic update — if two drivers tap "accept" simultaneously, exactly one gets `200`, the other gets `409 "already accepted by another driver"`. Driver flips to `ON_JOB`, their assigned vehicle (if any) flips to `ON_RECOVERY`. Socket `job:accepted` → `job:<id>` room. `JOB_ACCEPTED` notification → customer.
- **Rejected**: no status change at all — purely informational/logged. Other offered drivers remain able to accept. Don't remove the job from a driver's "incoming offers" UI for other drivers just because one rejected it.
- **EN_ROUTE**: no notification type exists for this transition (confirmed — `EN_ROUTE` intentionally sends nothing). Don't build a "driver is en route" push notification expectation; rely on the socket `job:status-changed` event for in-app UI instead.
- **ARRIVED**: `DRIVER_ARRIVED` notification → customer.
- **STARTED**: sets `startedAt`, `JOB_STARTED` notification → customer.
- **COMPLETED**: sets `completedAt` + `finalFare`, driver → `AVAILABLE`, vehicle → `AVAILABLE`, `JOB_COMPLETED` notification → customer. This is the point a rating becomes possible (`POST /jobs/:id/rating` requires `status === COMPLETED`).
- **CANCELLED**: sets `cancelledAt`/`cancellationReason`; if a driver was already assigned, driver → `AVAILABLE`, vehicle → `AVAILABLE`; `JOB_CANCELLED` notification → the other party (not re-notifying whoever triggered the cancellation).
- All of the above (except reject, which has no socket event) emit `job:status-changed` (or `job:accepted` for the accept case specifically) to the `job:<jobId>` socket room — this is the real-time channel a subscribed client (customer tracking their job, driver on their active job) should listen on rather than polling `GET /jobs/:id`.

## Client design implications

- A CUSTOMER's "track my job" screen should call `job:subscribe` over the socket immediately after `POST /jobs` succeeds (using the returned `_id`), then react to `job:status-changed`/`job:accepted`/`driver:location:changed` — not poll REST.
- A DRIVER's "incoming offer" screen should render from `job:new-request` (received because drivers auto-join their `company:<id>:fleet` room) and must independently verify eligibility client-side only for UX (still fully re-checked server-side on accept) — expect a possible 409/403/410 on tap and handle it gracefully (offer already taken / expired / no longer eligible), not just optimistically flip to "accepted."
- `EN_ROUTE` has no push notification — if the design shows a "your driver is on the way" push, that's driven by the socket event while the app is foregrounded, not an FCM push. Flag as a design/backend gap if the design explicitly expects a background push for this specific transition (see GAP-REPORT.md).
- Cancellation is a single shared action across all three roles/screens — implement one `cancelJob(jobId, reason)` call reused by Customer/Driver/Owner UIs rather than three different flows.
