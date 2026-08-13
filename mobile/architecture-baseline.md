# admill-mobile — Architecture Baseline

Full rationale for every frozen decision below. `CLAUDE.md` is the condensed day-to-day version — if the two conflict, this file wins and `CLAUDE.md` is stale and needs updating.

## 1. What this is

React Native (CLI, not Expo) TypeScript mobile app for **Admill Vehicle Recovery Services** (Dubai, UAE) — the mobile frontend for the same roadside-assistance/recovery-dispatch platform `admill-backend` already implements (Milestones 0–11 complete). Three roles, one app each: Customer (requests recovery), Driver (fulfills jobs), Owner (runs the fleet/company). Visual design source: `TezRecovery_Light__standalone_.html` + accompanying screenshots (light theme, amber/gold on warm-canvas). Functional source: `admill-backend` source code, distilled into `frontend-docs/*.md`.

**Sibling project note**: `D:\Admil\admill-frontend` is a separate, unrelated Next.js project. It is not touched, migrated, or reused by this project under any circumstance.

## 2. Relationship to the backend

The backend is finished and frozen for this frontend's purposes — this project consumes it, never modifies it. `frontend-docs/API-CONTRACT.md`, `ROLE-PERMISSION-MATRIX.md`, `JOB-LIFECYCLE.md`, `SOCKET-CONTRACT.md` are the distilled contract, produced by direct source audit (2026-08-09) and treated as authoritative unless the backend source itself is re-checked and found to disagree. `GAP-REPORT.md` lists 9 design-vs-backend gaps — do not build screens/calls against unsupported capabilities listed there; check it before assuming a feature has backend support.

## 3. Tech stack (frozen)

React Native CLI (TypeScript template) · React Navigation (native-stack + bottom-tabs) · React Native Paper (base component primitives, themed to our tokens — not used for its default visual identity) · TanStack Query (server state/caching) · Axios (HTTP, interceptor-based token refresh) · `react-native-keychain` (secure refresh-token storage) · `react-native-config` (typed env vars, no hardcoded secrets/URLs) · `socket.io-client` (matches backend exactly) · Jest + `@testing-library/react-native` (testing). `react-native-maps` is a planned dependency, deliberately **not installed until the real-time/tracking phase** — it needs a Maps API key we don't have configured yet and isn't needed before then.

No Redux/MobX/Zustand: auth session is the only genuinely cross-cutting client state in Phase 1, and it fits React Context. Revisit only if a later phase demonstrates real need — don't add state-management infrastructure speculatively.

## 4. Folder structure (scaffolded in Phase 1 — fill in, don't restructure without reason)

```
admill-mobile/
├── android/ ios/                  # RN CLI generated
├── src/
│   ├── api/                       # axios instance + one <resource>.api.ts per backend module
│   ├── auth/                      # Keychain token storage, session logic
│   ├── components/                # shared design-system components
│   ├── config/                    # env.ts (typed react-native-config wrapper), constants
│   ├── design-system/             # tokens.ts, theme.ts
│   ├── hooks/                     # useAuth, useSocketEvent, etc.
│   ├── navigation/                # RootNavigator, AuthNavigator, OwnerNavigator, DriverNavigator, CustomerNavigator
│   ├── socket/                    # SocketService singleton
│   ├── types/                     # TS types mirroring API-CONTRACT.md enums/entities
│   ├── utils/
│   └── features/
│       ├── auth/ customer/ driver/ owner/ jobs/ tracking/ notifications/ profile/
├── frontend-docs/                 # Phase 0 audit output (do not delete/rewrite historically)
├── CLAUDE.md  architecture-baseline.md  PROGRESS.md
```

## 5. Key architectural decisions (frozen — implement these, don't redesign them)

1. **No role-switching.** Role is set at registration on the backend and never changes; `RootNavigator` branches once on `user.role` into `OwnerNavigator`/`DriverNavigator`/`CustomerNavigator`. Frontend role checks are UX/navigation convenience only — the backend is the actual authorization boundary (`ROLE-PERMISSION-MATRIX.md`).
2. **Two-step profile creation is a first-class navigation state**, not an edge case. A DRIVER/CUSTOMER user can be authenticated but have no `Driver`/`Customer` profile yet (`POST /drivers`/`POST /customers` not yet called) — the relevant navigator must branch on "no profile" → onboarding, "profile pending approval" (driver only) → waiting screen, "profile complete" → real home. See `ROLE-PERMISSION-MATRIX.md` §two-step profile creation.
3. **Access tokens live in memory only** (~15min lifetime, not worth persisting); **refresh tokens live in `react-native-keychain`** (OS-level secure storage), never AsyncStorage/plain state. App launch attempts a silent `/auth/refresh` from the stored refresh token before falling back to the login screen.
4. **One axios instance, one response/error interceptor.** 401 triggers exactly one silent refresh-and-retry; a second 401 (refresh itself failed) clears the session and routes to `AuthNavigator`. Never hand-roll a second token-refresh path in an individual screen/API call.
5. **One `SocketService` singleton**, not per-screen `io()` calls. Connects once post-login with the current access token, reconnects after every token refresh. Screens subscribe via a `useSocketEvent` hook, never touch the raw socket instance. Event/payload set is exactly `SOCKET-CONTRACT.md` — no invented events.
6. **GPS send cadence (4s on-job / 15s idle) is entirely client-side**, implemented as an interval inside the tracking feature, not a backend concept — the backend accepts location updates at any rate.
7. **Design tokens are provisional pending a live render of the HTML artifact.** `TezRecovery_Light__standalone_.html` is a compiled bundle with no extractable source text (confirmed by direct read in Phase 0) — colors/spacing/type values used in Phase 1 (`#F5A623` / `#F4F2EE` / `#14161A` + reasonable derived scale) are carried over from prior screenshot review, not fresh pixel measurement. Re-verify against a live render before the design system is treated as "locked" for full-screen implementation.
8. **Never build UI against a `GAP-REPORT.md` item as if it were supported.** OTP, chat, customer-owned vehicles, PDF receipts, owner manual job assignment, driver period-earnings breakdown, and driver suspend/leave all have no backend support today — omit/defer these, don't fake them client-side.
9. **API-CONTRACT.md's envelope and pagination are the only shapes used.** Every API response is `{success, data, message?, meta?}`; every error is `{success:false, message}` (a single string, not field-keyed) — don't build per-field inline validation error UI that assumes a structured error object from the server without first splitting/parsing that string client-side.
10. **`frontend-docs/` is never rewritten historically.** Phase 0 output stays as-is; new phases add new docs or append to `PROGRESS.md`, they don't edit Phase 0's findings after the fact (a re-audit that supersedes a finding gets a new dated note, not a silent edit).

## 6. Phase roadmap

0. **Compatibility Audit** — COMPLETE (2026-08-09). `frontend-docs/*.md`.
1. **Frontend Foundation** — RN project init, design-system tokens/components, API client, auth infrastructure, role-based navigation skeleton, socket service skeleton, 3 placeholder role homes. *(current phase)*
2. **Owner Experience** — company/fleet/driver management, job monitoring, analytics screens, live fleet map.
3. **Driver Experience** — registration/documents, availability toggle, incoming offers, active job flow, live location sending, earnings (simple total).
4. **Customer Experience** — service request flow, fare estimate, matching/live tracking, job history, rating, notifications, profile.
5. **Real-Time & Maps Deep-Integration** — full socket wiring into the above screens, `react-native-maps` added, route/marker rendering, GPS cadence implementation.
6. **Reports & Polish** — remaining analytics/reporting screens, empty/loading/error states audit, accessibility pass.
7. **Testing & Hardening** — fuller test coverage, performance pass, release build config.

Per-phase detail is added to this file (or a linked doc) as each phase starts, mirroring how the backend's milestone sections were written just-in-time rather than all up front.
