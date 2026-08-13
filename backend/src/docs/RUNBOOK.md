# Admill Backend — Deployment Runbook

Short, practical reference for deploying, rolling back, and finding logs. The target
deployment shape (single Node process, managed Atlas/Cloudinary/Firebase, no Redis) is
the one already decided in `architecture-baseline.md` §21 — this doc doesn't introduce
a different one.

---

## 1. Prerequisites

- A host that runs a single long-lived Node process behind HTTPS (Railway, Render, or a
  small EC2/Lightsail instance — architecture-baseline.md §21). The platform's built-in
  HTTPS termination is sufficient; this app does not terminate TLS itself.
- A MongoDB Atlas cluster (free/shared tier is enough at MVP scale).
- Cloudinary account (file storage) and OpenWeatherMap API key (pricing engine) —
  both **required**; the server refuses to boot without them (`src/config/env.ts`).
- Optional, graceful-degradation-if-absent: `OPENROUTESERVICE_API_KEY`,
  `FUEL_PRICE_EXTERNAL_API_URL`, `FCM_PROJECT_ID`/`FCM_CLIENT_EMAIL`/`FCM_PRIVATE_KEY`.
- Node.js (match the version CI uses — see `.github/workflows/ci.yml`).

## 2. Environment variables

Every required/optional variable and its validation rule lives in one place:
`src/config/env.ts`. Don't guess the list from memory — read that file directly before
configuring a new environment; it's the single source of truth and the server will
refuse to start with a clear per-variable error if anything required is missing or
malformed (Milestone 0's whole design point).

Never commit real values — `.env` is git-ignored; `.env.example` documents the shape.

## 3. Deploy

1. `npm ci` — clean install from the committed lockfile (exact versions, matching
   Milestone 11's dependency pinning — never `npm install` on a production host, which
   could resolve slightly different versions than what CI tested).
2. `npm run build` — compiles `src/` + `server.ts` to `dist/` via `tsc`.
3. `npm run start` — runs `node dist/server.js`. This is the actual entrypoint
   (`server.ts`): connects to MongoDB, then starts the HTTP+Socket.IO server, and exits
   non-zero with a logged error if either step fails — a failed deploy should be visibly
   failed, not silently half-running.
4. Confirm `GET /health` returns `200` with `{ success: true, data: { status: "OK", ... } }`
   before considering the deploy live (Milestone 0's health check, unchanged since).
5. On the platform's dashboard, verify only the intended env vars are set for that
   environment (staging vs. production `MONGO_URI`/`FRONTEND_URL`/etc. must never be mixed).

CI (`.github/workflows/ci.yml`) runs `typecheck` → `lint` → `test` on every push/PR to
`main`/`master`. Treat a red CI run as a hard stop — do not deploy a commit CI hasn't
passed on.

## 4. Roll back

This is a single stateless Node process with no in-process session state (auth is
JWT + a `RefreshToken` collection in Mongo, not server memory) and Socket.IO needs no
sticky sessions at single-instance scale (§21/§22) — so rollback is just "run the
previous known-good build":

1. Redeploy the previous known-good commit/release through the same path as §3 above
   (most host platforms — Railway/Render — keep prior deploys one click away; for a
   plain EC2/Lightsail box, `git checkout <previous-tag-or-sha>` then repeat §3).
2. Re-check `GET /health`.
3. If the rollback was due to a bad migration-shaped change (a new required field, a
   new index), confirm the previous code version still tolerates the current DB shape
   before assuming rollback alone is sufficient — this codebase has no formal migration
   runner; schema changes have shipped as additive, backward-tolerant fields throughout
   M0–M11 (see `PROGRESS.md`'s per-milestone "Deviations" sections), so this is usually
   a non-issue, but check the specific change being rolled back from.
4. There is no automatic traffic draining/blue-green step at this deployment scale —
   a rollback means a brief restart, same as any deploy.

## 5. Where logs live

- The app logs structured JSON via `pino` (`src/utils/logger.ts`) to **stdout** —
  never to a local file. Whatever the hosting platform captures from the process's
  stdout *is* the log store (Railway/Render both have a built-in log viewer that
  tails this automatically; for a raw EC2/Lightsail box, run it under a process
  manager — e.g. `pm2` or a systemd unit — that redirects stdout to a log file or
  forwards it to a log aggregator).
- Every request gets a `requestId` (UUID, `src/middlewares/logger.middleware.ts`) that
  appears on every log line for that request — grep/filter by `requestId` to trace one
  API call end to end across service/repository logs.
- Sensitive fields are redacted at the logger level (`redact` config in `logger.ts`:
  `req.headers.authorization`, `*.password`, `*.token`, `*.refreshToken`) as defense in
  depth — verified directly (Milestone 11) that no call site in `src/` ever passes a
  raw request body or credential value into a log call in the first place.
- `NODE_ENV=production` disables `pino-pretty`'s colorized dev formatting and emits
  plain single-line JSON — the shape every log aggregator (Datadog, Better Stack, the
  platform's own viewer) expects.

## 6. Health/monitoring

- `GET /health` — liveness/readiness check, no auth required. Point the hosting
  platform's health-check config at this path.
- No separate metrics endpoint exists yet (out of scope for the current milestones) —
  request-level timing (`durationMs`) is already in every "request completed" log line
  if you need to derive latency metrics from logs in the meantime.
