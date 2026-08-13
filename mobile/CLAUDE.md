# Admill Fleet Management System (AFMS) — Mobile Frontend

React Native mobile app for Admill Vehicle Recovery Services (Dubai, UAE) — consumes the existing, complete `admill-backend`. Three roles: Owner, Driver, Customer, each with their own navigator and screens.

**Architecture and roadmap are frozen.** Full rationale lives in `architecture-baseline.md` — treat that as ground truth for *why*. This file is the condensed day-to-day version for *how*. If they conflict, `architecture-baseline.md` wins.

**Sibling project**: `D:\Admil\admill-frontend` is a separate Next.js project. Never modify, delete, rename, or reuse anything from it.

## Non-negotiable process rules

- **One phase at a time**, in the order in `architecture-baseline.md` §6. Don't start the next phase until the current one's acceptance criteria are met and explicitly confirmed.
- **Backend is authoritative for functionality; design is authoritative for visuals; `frontend-docs/GAP-REPORT.md` is authoritative for what's deferred.** Never invent backend capability to make a screen look complete — check `frontend-docs/API-CONTRACT.md` and, if still ambiguous, the actual `admill-backend` source, before assuming an endpoint/behavior exists.
- **No role-switcher, ever.** Role is fixed at registration; `RootNavigator` branches once and stays branched.
- **Frontend role checks are UX only, not security.** The backend enforces every real permission (`frontend-docs/ROLE-PERMISSION-MATRIX.md`).
- **Strict TypeScript.** No `any` without a specific, commented reason.
- **One axios instance, one SocketService singleton.** Don't hand-roll a second HTTP client or a second `io()` connection anywhere.
- **Don't invent socket events, job statuses, or endpoints.** Use exactly what's in `frontend-docs/SOCKET-CONTRACT.md`, `frontend-docs/JOB-LIFECYCLE.md`, `frontend-docs/API-CONTRACT.md`.
- After finishing a phase: run `tsc --noEmit`, ESLint, Jest, and (if native code changed) `gradlew assembleDebug`; report results and what's left before declaring the phase done — don't self-declare completion.
- If something is genuinely ambiguous, check in order: actual backend source → `frontend-docs/API-CONTRACT.md` → `ROLE-PERMISSION-MATRIX.md` → `JOB-LIFECYCLE.md` → `SOCKET-CONTRACT.md` → `DESIGN-MAPPING.md` → `GAP-REPORT.md` → this file → `architecture-baseline.md`. If still ambiguous, stop and ask — don't guess.

## Tech stack

React Native CLI + TypeScript, React Navigation, React Native Paper (themed primitives, not default visuals), TanStack Query, Axios, `react-native-keychain`, `react-native-config`, `socket.io-client`, Jest + RNTL. `react-native-maps` added later (Phase 5), not yet installed.

## Folder structure (already scaffolded — fill in, don't restructure)

```
src/
├── api/            axios instance + per-resource API wrappers
├── auth/           Keychain token storage, session logic
├── components/     shared design-system components
├── config/         typed env, constants
├── design-system/  tokens, theme
├── hooks/
├── navigation/      RootNavigator + Auth/Owner/Driver/Customer navigators
├── socket/          SocketService singleton
├── types/           mirrors API-CONTRACT.md
├── utils/
└── features/        auth, customer, driver, owner, jobs, tracking, notifications, profile
```

## Key decisions already made (don't redesign — see architecture-baseline.md §5 for full rationale)

1. Access token in memory only; refresh token in `react-native-keychain`.
2. Single axios interceptor handles 401 → silent refresh-and-retry once → clear session on second failure.
3. Two-step profile creation (Driver/Customer) and driver-approval-pending are real navigation states, not edge cases.
4. GPS cadence (4s on-job / 15s idle) is a client-side interval — the backend has no cadence enforcement.
5. Design tokens (`#F5A623` / `#F4F2EE` / `#14161A` + derived scale) are provisional until the design HTML is re-rendered live and checked — it's a compiled bundle with no extractable source text.
6. Never build against a `GAP-REPORT.md` item (OTP, chat, customer-owned vehicles, PDF receipts, owner manual job assignment, driver period-earnings, driver suspend/leave) as if it's supported.

## Phase roadmap

See `architecture-baseline.md` §6. Current: **Phase 1 — Frontend Foundation.**

## Documentation

- `frontend-docs/` — Phase 0 audit output, never rewritten historically.
- `PROGRESS.md` — phase-by-phase log, appended after each phase, never rewritten.
- `architecture-baseline.md` — frozen decisions + full rationale.
