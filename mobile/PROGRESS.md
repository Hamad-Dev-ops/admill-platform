# admill-mobile — Progress Log

Phase-by-phase log. Never rewritten historically — new phases append below.

## Phase 0 — Compatibility Audit — COMPLETE (2026-08-09)

Full detail in `frontend-docs/PROGRESS.md`. Summary: audited `admill-backend` source directly (REST API surface, Socket.IO contract, role/permission model, job state machine); inspected the design artifact (confirmed compiled bundle, no extractable source text); produced `frontend-docs/{API-CONTRACT,ROLE-PERMISSION-MATRIX,JOB-LIFECYCLE,SOCKET-CONTRACT,DESIGN-MAPPING,GAP-REPORT}.md`; identified 9 design/backend gaps (OTP, chat, customer-owned vehicles, PDF receipts, owner manual job assignment, driver period-earnings breakdown, driver suspend/leave, plus 2 model-mismatch notes). No code written.

## Phase 1 — Frontend Foundation — COMPLETE (2026-08-09 → 2026-08-10)

**Decisions confirmed this phase**: React Native (CLI, not Expo) at `D:\Admil\admill-mobile`; `admill-frontend` (Next.js) stays completely separate/untouched; Android verification for this phase is build-only (`gradlew assembleDebug`) — no emulator/device is available in this environment.

### What was implemented

- **Project**: RN CLI TypeScript template, pinned to React Native 0.86.2 / React 19.2.3 (latest stable at time of init), scaffolded in a scratch dir and merged into `admill-mobile` without touching `frontend-docs/`, `CLAUDE.md`, `architecture-baseline.md`, or `PROGRESS.md`. Package name changed `AdmillMobile` → `admill-mobile` in `package.json` only (native app id/display name untouched).
- **Design system** (`src/design-system/`): `tokens.ts` (colors, typography, spacing, radius, elevation — 3 colors confirmed from the design bundle, rest provisional pending a live re-render, per `architecture-baseline.md` §5.7), `theme.ts` (maps tokens onto a React Native Paper `MD3Theme`).
- **Core components** (`src/components/`): `Button`, `IconButton`, `TextInput`, `SearchInput`, `Card`, `StatusChip`, `Avatar`, `Header`, `BottomTabBar`, `Modal`, `BottomSheet`, `LoadingState`, `EmptyState`, `ErrorState` — thin themed wrappers over React Native Paper primitives, each using the token file, not hardcoded values.
- **API layer** (`src/api/`): `client.ts` (single axios instance; request interceptor attaches the in-memory access token; response interceptor does exactly one silent refresh-and-retry on 401, then clears the session — never loops), `auth.api.ts`, `customers.api.ts`, `companies.api.ts`, `drivers.api.ts` — all typed directly against `frontend-docs/API-CONTRACT.md`, not assumptions.
- **Auth infrastructure** (`src/auth/`): `tokenStorage.ts` (refresh token in `react-native-keychain`, never AsyncStorage), `localCache.ts` (driver id cache — see gap #10 below), `AuthContext.tsx` (session state machine: `loading`/`unauthenticated`/`authenticated`; silent restore on launch; login/register/logout; wires itself into the API client's 401 handler and the SocketService connect/disconnect/reconnect lifecycle).
- **Navigation** (`src/navigation/`): `RootNavigator` branches once on `status`+`role` (no role-switcher, ever) into `AuthNavigator` (Login/Register) or `Owner/Driver/CustomerNavigator`. Each role navigator gates on `useProfileStatus()` (new hook, `src/hooks/useProfileStatus.ts`) before showing its tab navigator — real "no profile yet" / driver "pending approval" / driver "rejected" screens (`ProfileIncompleteScreen`), not stubs, wired to the actual `GET /customers/me` / `GET /companies/me` / driver-id-cache-based lookup.
- **Screens**: real `LoginScreen`/`RegisterScreen` (react-hook-form + zod, validated against the backend's actual field constraints) — not placeholders, since the acceptance criteria's routing chain starts at Login. `OwnerHomeScreen`/`DriverHomeScreen`/`CustomerHomeScreen` are the three required placeholder homes.
- **Socket** (`src/socket/SocketService.ts`): singleton with `connect(token)`/`disconnect()`/`reconnect(token)`/`subscribeToJob()`/`sendLocationUpdate()`, typed exactly to `frontend-docs/SOCKET-CONTRACT.md`'s 6 events — no invented events. `useSocketEvent` hook (`src/hooks/`) for declarative subscription. Wired into `AuthContext` (connects after login/restore, disconnects on logout, reconnects after token refresh) but not yet consumed by any screen — that starts in Phase 2+.
- **Env/config**: `react-native-config` (`.env`/`.env.example`, gitignored), `src/config/env.ts` (zod-validated, fails fast on missing vars), native Android wiring (`dotenv.gradle` + `fonts.gradle` applied in `android/app/build.gradle`).
- **Testing**: Jest + `@testing-library/react-native` 14.x (its `render()` is async in this version — all tests `await render(...)`). `axios-mock-adapter` added as a dev dependency for API client tests. 6 suites / 17 tests: API client (auth header attach, 401-retry-once, refresh-failure clears session, no-refresh-loop on auth endpoints), AuthContext (unauthenticated start, login, logout), RootNavigator (role→navigator routing, all 3 roles + unauthenticated), Button, StatusChip, default App smoke test.

### Files created (highlights — full tree under `src/`, `__tests__/`, `__mocks__/`)

`CLAUDE.md`, `architecture-baseline.md`, `PROGRESS.md` (this file) at repo root; `src/{api,auth,components,config,design-system,hooks,navigation,socket,types}/**`; `src/features/{auth,owner,driver,customer,profile}/**`; `__tests__/{api,auth,navigation,components}/**`; `__mocks__/react-native-keychain.js`, `__mocks__/react-native-config.js`; `react-native-config.d.ts`; `.env`, `.env.example`.

### Dependencies added

Runtime: `@react-navigation/{native,native-stack,bottom-tabs}`, `react-native-screens`, `react-native-gesture-handler`, `react-native-paper`, `react-native-vector-icons`, `axios`, `@tanstack/react-query`, `react-native-keychain`, `react-native-config`, `socket.io-client`, `@react-native-async-storage/async-storage`, `zod`, `react-hook-form`, `@hookform/resolvers`. Dev: `@testing-library/react-native`, `axios-mock-adapter`. `react-native-maps` deliberately **not** added yet — no Maps API key configured, not needed before Phase 5 (architecture-baseline.md §3, §6).

### Architecture decisions made/confirmed while implementing

- `Card` wraps Paper's `Card` with a deliberately minimal prop surface (not `Omit<PaperCardProps,'mode'>`) — Paper's `Card` props are a mode-discriminated union that doesn't survive `Omit` cleanly; TS couldn't reconcile a fixed `mode="elevated"` with a spread of the full union. A narrow explicit interface avoided the whole class of error.
- `BottomTabBar` reads `insets` from its own `BottomTabBarProps` rather than calling `useSafeAreaInsets()` itself — `@react-navigation/bottom-tabs`'s `BottomTabView` invokes the `tabBar` prop as a **plain function call** inside a context-consumer render-prop (confirmed in its source), not via JSX/`createElement`, so a hook call inside crashes with "Invalid hook call" the moment `tabBar={BottomTabBar}` is passed directly (found via the test suite, not assumed). react-navigation already computes the correct insets and hands them in as a prop — use that.
- All screens use `SafeAreaView` from `react-native-safe-area-context`, not the deprecated core-RN one (caught via a Jest console warning, fixed everywhere it appeared).

### Test results

- `tsc --noEmit`: clean, 0 errors.
- `eslint .`: clean, 0 errors, 0 warnings (started with 13 warnings — inline styles, `no-void`, unstable nested components, an ineffective disable-comment — all fixed, not suppressed).
- `jest`: 6 suites / 17 tests passing.
- `gradlew assembleDebug`: **BUILD SUCCESSFUL** (307 tasks, Gradle-reported 15m53s; wall-clock was much longer in this sandboxed environment — first-ever build compiling New Architecture/Fabric native C++ codegen for every autolinked module across all 4 default ABIs, confirmed genuine via steady `.cxx`/dex output growth across many checks, not a hang). Produced `android/app/build/outputs/apk/debug/app-debug.apk` (162MB debug APK, unstripped/unoptimized as expected for a debug build).
- Not verified: actual runtime behavior on a device/emulator — none available in this environment (agreed with you before starting: build-only verification for this phase).

### Known issues / deferred items

- **New gap discovered while building the driver profile-status check** (not in the original Phase 0 audit): the backend has no `GET /drivers/me` — added as gap #10 to `frontend-docs/GAP-REPORT.md`, with the current workaround (local id cache from registration) documented in `src/api/drivers.api.ts`. Recommend requesting this small backend addition before Phase 3 (Driver Experience) is built out, since the workaround doesn't survive reinstall/new-device login.
- Design tokens are provisional (3 confirmed colors, rest derived) — flagged for re-verification against a live render of the HTML bundle before Phase 2 locks the design system.
- First Android build was very slow in this environment (New Architecture C++ compilation across 4 ABIs). Future optimization worth considering for faster dev-loop builds: `reactNativeArchitectures=arm64-v8a` in `android/gradle.properties` to build only one ABI locally (not applied — a deliberate choice to keep the default multi-ABI release-shape build untouched without your sign-off).
- No screen beyond the required foundation is implemented (by design — Phase 1 scope).

### Next

Phase 2 — Owner Experience (company/fleet/driver management, job monitoring, analytics screens, live fleet map), per `architecture-baseline.md` §6.

## Phase 2 — Owner Experience — COMPLETE (2026-08-10)

**Preflight audit** (before any code): re-verified backend field-level shapes directly against source (`IVehicle`, `IDriver`, `IJob`, `ICompany`, `ICompanySettings`, `INotification`, `IRating`, `IDocument`, analytics response shapes) rather than trusting the Phase 0 API-CONTRACT.md summary blindly — found and fixed one real Phase 1 bug (`DriverProfileSummary.driverCode` should be `employeeId`; never read anywhere so no runtime impact, fixed before it could cause one) and confirmed two integration realities not previously documented: (1) `Vehicle.assignedDriver`/`Job.driverId` etc. are never populated by the backend — resolved client-side via cached driver/vehicle roster lookups, not a gap; (2) the backend has **no Owner-facing customer lookup at all** — new gap #11 in `GAP-REPORT.md`, handled by omitting customer identity from job displays rather than fabricating it.

### Sub-phases

**2.1 Owner shell/navigation** — `OwnerNavigator` restructured from a single placeholder tab into a Stack (`OwnerStackParamList`: `OwnerTabs`, `VehicleDetail`, `VehicleForm`, `DriverDetail`, `JobDetail`, `Notifications`, `Analytics`, `Settings`) hosting a 5-tab `OwnerTabNavigator` (`Dashboard`, `Fleet`, `Jobs`, `Tracking`, `More`) via the existing themed `BottomTabBar`. Driver Management was folded into the Fleet tab via an in-screen segmented toggle (Vehicles/Drivers) rather than a 6th bottom tab or a new `material-top-tabs` dependency.

**2.2 Owner Dashboard** — real data only, no fabricated stats: fleet overview from `GET /analytics/fleet-utilization`, today's revenue from `GET /analytics/revenue` (date-ranged to today), pending/active job counts from `GET /jobs?status=X&limit=1` reading `meta.total` per status (6 cheap calls, not a full fetch), recent activity from `GET /jobs`. New shared `MetricCard` component.

**2.3 Fleet / Vehicles** — `GET/POST/PATCH /vehicles`, `POST /vehicles/:id/assign-driver` fully wired. List with search + status filter, detail screen with assign/reassign-driver flow (only `APPROVED` drivers offered), create/edit form (react-hook-form + zod, mirrors the backend's `createVehicleSchema` exactly). Expiry dates are plain `YYYY-MM-DD` text fields, not a native date picker — deliberately deferred to avoid another native dependency/rebuild cycle in an environment where a single `gradlew assembleDebug` already takes a very long time; documented as a real (not fake) simplification.

**2.4 Driver Management** — `GET /drivers` (list, roster + approval filter), `GET /drivers/:id`, `PATCH /drivers/:id/approve`, `PATCH /drivers/:id/reject`. Driver detail shows identity (when populated), status, approval, rating, trips, assigned vehicle (reverse-resolved via the vehicle roster), documents' expiry fields, and an approve/reject flow for `PENDING_APPROVAL` drivers. Deliberately **no** suspend/on-leave controls (no backend endpoint — gap #8) and **no** manual job-assignment control anywhere (gap #7).

**2.5 Jobs / Operations** — `GET /jobs` (status-filterable list), `GET /jobs/:id`, `PATCH /jobs/:id/status` for cancellation only — the actual state machine and Owner's real permission (cancel any non-terminal job, no other transition) enforced client-side to match the backend exactly, not an invented lifecycle. Job detail omits customer identity (gap #11) with an inline code comment explaining why, and subscribes to `job:status-changed`/`job:accepted` over the socket for live updates on top of the REST-sourced initial state.

**2.6 Live Fleet Tracking** — added `react-native-maps` (deferred since Phase 1 for exactly this point). Initial snapshot from `GET /drivers` (which already includes each driver's last-known `currentLocation` — no extra endpoint needed), live updates via `driver:location:changed` (Owner auto-joins `company:<id>:fleet`), `job:new-request` triggers a roster refresh. Markers colored by driver status, tap-through to Driver detail. Android Google Maps API key wired via `react-native-config` → `AndroidManifest.xml` `meta-data` (empty in this environment — no key obtained; documented in `.env.example` with signup instructions — map mounts and markers position correctly regardless, only tile imagery needs the real key).

**2.7 Notifications** — `GET /notifications`, `PATCH /notifications/:id/read`, live `notification:new` (invalidates the list + the header/dashboard unread-count badge). New `useUnreadNotificationCount` hook (REST is the source of truth; the socket event only triggers a refetch, never applied as a payload directly) used by the Dashboard's bell icon.

**2.8 Reports / Analytics** — all three Owner analytics endpoints, date-range presets (Today/This Week/This Month, computed client-side), driver performance sorted by revenue, fleet status breakdown rendered as simple proportional bars (no charting library added — plain `View` width percentages, avoiding another native/JS dependency for Phase 2's scope).

**2.9 Company Settings** — `GET/PATCH /companies/me`, `GET/PATCH /companies/me/settings`, `GET/POST /pricing/config`. Pricing section carries a persistent on-screen warning ("platform-wide... not isolated to your company") plus a native confirmation dialog before every save, specifically because this is the first screen where that already-known backend gap becomes a real, directly-actionable mutation risk for a user — not just a documentation footnote anymore.

**2.10 Final integration/polish** — `GAP-REPORT.md` updated with a "Phase 2 resolution notes" section confirming exactly how gaps #7/#8/#9/#10/#11 were actually handled in the shipped UI (not just planned). Full verification below.

### Files created (by area, non-exhaustive highlights)

- `src/navigation/owner/{types,OwnerTabNavigator}.tsx`, rewritten `src/navigation/OwnerNavigator.tsx`
- `src/api/{vehicles,jobs,analytics,notifications,pricing}.api.ts`, expanded `drivers.api.ts`/`companies.api.ts`
- `src/features/owner/{dashboard,fleet,drivers,jobs,tracking,notifications,analytics,settings,more,shared}/**` (screens, sub-components, hooks, label maps, zod schemas)
- `src/components/{MetricCard,SelectableChipGroup}.tsx`
- `src/utils/statusPresentation.ts` (centralized status label/tone maps for Job/Vehicle/Driver/Approval/Document enums)
- `src/hooks/useUnreadNotificationCount.ts`
- `__mocks__/react-native-maps.js`
- `__tests__/owner/**` — one test file per screen/hook built this phase

### Files modified

`src/components/StatusChip.tsx` (JobStatus-specific → tone-based, reusable across all enums), `src/components/Card.tsx` (Phase 1 TS fix generalized), `src/components/BottomTabBar.tsx` (unrelated to this phase's features — no change needed, listed only if touched), `src/types/entities.ts` (fixed `driverCode`→`employeeId`, added `Driver`/`Vehicle`/`Job`/`Notification`/`Rating`/`AppDocument`/`CompanySettings`/`PricingConfig`/analytics types), `App.tsx` (no change needed this phase), `jest.config.js` (n/a — no change needed), `.env`/`.env.example`/`react-native-config.d.ts`/`AndroidManifest.xml` (Google Maps API key wiring), `package.json` (react-native-maps added).

### Files deleted

None.

### Backend APIs integrated this phase

`GET/POST/PATCH /vehicles`, `POST /vehicles/:id/assign-driver`, `GET /drivers`, `PATCH /drivers/:id/approve`, `PATCH /drivers/:id/reject`, `GET /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id/status` (cancel only), `GET /notifications`, `PATCH /notifications/:id/read`, `GET /analytics/revenue`, `GET /analytics/drivers`, `GET /analytics/fleet-utilization`, `GET/PATCH /companies/me`, `GET/PATCH /companies/me/settings`, `GET/POST /pricing/config`.

### Socket events integrated

`driver:location:changed` (Fleet Tracking), `job:new-request` (Jobs list + Fleet Tracking roster refresh), `job:status-changed`/`job:accepted` (Job detail), `notification:new` (Notifications screen + unread-count badge).

### Design components reused vs added

Reused unchanged: `Button`, `TextInput`, `SearchInput`, `Card`, `Avatar`, `Header`, `BottomTabBar`, `Modal`, `LoadingState`, `EmptyState`, `ErrorState`, `IconButton`. Generalized: `StatusChip` (was JobStatus-only). Added: `MetricCard`, `SelectableChipGroup` — both generic enough to be reused by Driver/Customer phases later, not Owner-specific one-offs.

### Tests added

19 new test files under `__tests__/owner/**` covering: dashboard data aggregation + all render states, driver lookup resolution, fleet list + filtering, driver roster + approve/reject flow, jobs list + cancel flow (including the terminal-status-hides-cancel-button case), live tracking markers + socket-driven position updates, notifications list + mark-read (including the already-read no-op case), analytics rendering + sort order, settings rendering including the mandatory pricing warning text. Total suite: **19 suites / 44 tests, all passing** (up from Phase 1's 6/17).

### Verification results

- `tsc --noEmit`: clean, 0 errors.
- `eslint .`: clean, 0 errors, 0 warnings.
- `jest`: 19 suites / 44 tests passing.
- `gradlew assembleDebug`: **BUILD SUCCESSFUL in 3m 52s** (336 tasks: 78 executed, 258 up-to-date from Phase 1's cache — confirms the new native work this phase, mainly `react-native-maps`' own Fabric codegen across 4 ABIs, was the only genuinely new native compilation, everything else was correctly cached). Produced a new `android/app/build/outputs/apk/debug/app-debug.apk` (189MB, up from Phase 1's 162MB — the size increase is `react-native-maps`' native libraries across 4 ABIs).

### Known limitations / technical debt

- Vehicle/driver expiry dates use plain text `YYYY-MM-DD` fields, not a native date picker (deliberate — avoids another native module/rebuild cycle this phase; revisit if the UX cost becomes a real complaint).
- Fleet utilization/analytics charts are plain proportional bars, not a charting library — adequate for Phase 2's scope, revisit if richer visualization is explicitly requested.
- Google Maps tiles won't render in this environment (no API key obtained) — markers, live updates, and all logic are real and correct regardless; cosmetic only, and the fix is a config value, not code.
- A pre-existing, benign Jest/React-Query interaction (`act()` warnings on mutation `onSuccess` callbacks, and "worker process failed to exit gracefully") appears across several test files — does not fail any test, tracked as a known test-infra quirk, not a product bug.
- Job list/detail cannot show customer identity (gap #11, see GAP-REPORT.md) — inherent backend limitation, not a frontend shortcut.

### Backend gaps encountered

Gap #11 (new, this phase): no Owner-facing customer lookup endpoint — see `GAP-REPORT.md`. All other gaps referenced (#7, #8, #9, #10) were already known; this phase confirmed exactly how each was actually handled in shipped UI (see "Phase 2 resolution notes" in `GAP-REPORT.md`).

### Next

Phase 3 — Driver Experience, per `architecture-baseline.md` §6. `GET /drivers/me` (gap #10) should be requested/resolved before that phase starts, since the current local-id-cache workaround doesn't survive reinstall/new-device login and Phase 3 is exactly where that limitation becomes user-facing.

## Phase 3 — Driver Experience — COMPLETE (2026-08-10)

**Preflight audit** (before any code): re-verified the Driver-relevant backend surface directly against source rather than trusting Phase 0/2 documentation — confirmed the job accept race-safety mechanism (atomic `findOneAndUpdate` filtered on `{status:PENDING, expiresAt:{$gt:now}}`, losing driver gets 409, expired gets 410), the Driver-only progression subset of the job state machine (EN_ROUTE/ARRIVED/STARTED/COMPLETED, assigned driver only), and the actual `DriverStatus`/`DriverApprovalStatus` enums. Found and corrected two undocumented socket-contract subtleties (now in `SOCKET-CONTRACT.md`): `job:new-request` broadcasts to the entire company fleet room unfiltered (client must check its own driver `_id` is in `offeredDriverIds`), and a driver cannot `job:subscribe`/`GET /jobs/:id` a job they've been offered but not yet accepted (`assertJobAccess` requires `driverId` to already equal their own id) — the incoming-offer UI is built from the socket payload alone, never re-fetched.

**Backend change (pre-authorized, gap #10 only)**: added `GET /drivers/me` — `DriverService.getMyProfile`, `DriverController.getMe`, route registered before `/:id`. Mirrors `CustomerService.getMyProfile` exactly; resolves the driver by the caller's own `userId`, so no client-supplied id is ever trusted. 5 new integration tests (`tests/integration/driverMe.test.ts`), full backend suite re-verified afterward (94/96 passing; the 2 failures are pre-existing real-I/O timeout-boundary tests unrelated to this change, confirmed environmental across 3 isolated re-runs — see backend `PROGRESS.md`). No other backend changes were made or needed this phase.

### Sub-phases

**3.1 Driver navigation/shell** — `DriverNavigator` rewritten: profile-gate (loading → no-profile → pending-approval → rejected → ready) exactly mirroring the Owner/Customer pattern, hosting a 4-tab `DriverTabNavigator` (Dashboard/Jobs/Earnings/Profile) plus a Stack for JobDetail/Notifications/Vehicle/Documents/EditProfile. Two always-mounted global overlays (`DriverOfferOverlay`, `DriverLocationTrackingRunner`) sit alongside the Stack, not inside it, so an incoming offer or the GPS loop survive regardless of which screen is focused.

**3.2 Onboarding/approval** — real `DriverRegistrationScreen` (company code + identity fields, react-hook-form + zod mirroring the backend's `registerDriverSchema`) replacing the old local-id-cache workaround entirely now that gap #10 is resolved. Approval states use the real `DriverApprovalStatus` enum — no driver is ever shown a status implying they can go online before `APPROVED`.

**3.3–3.4 Dashboard + status controls** — real `DriverDashboardScreen` (approval-aware, status toggle hidden while `ON_JOB`, active job card, vehicle card, notification bell) and `DriverStatusToggle` (AVAILABLE/OFFLINE/ON_BREAK only — the actual backend self-service subset; `ON_JOB` is system-set, `ON_LEAVE`/`SUSPENDED` have no self-service endpoint at all). Duplicate/no-op requests are prevented client-side.

**3.5–3.6 Offers + accept/reject** — `useIncomingJobOffer` filters the unfiltered `job:new-request` broadcast by the driver's own `_id`, holding the offer entirely from the socket payload (never re-fetched, per the preflight finding above). `IncomingJobOfferModal` calls `POST /jobs/:id/accept`/`reject`, handling 200 (success), 409 (lost the race — "Another driver already accepted this job"), 410 (expired), and other errors distinctly; a live countdown renders from `expiresAt`. Reject is understood correctly as not changing job status.

**3.7 Active job + progression** — `DriverJobDetailScreen` subscribes to the job's socket room post-acceptance, drives status forward only through the actual Driver-permitted transitions (`jobProgression.ts`'s `NEXT_DRIVER_STATUS` map, backed by `PATCH /jobs/:id/status`), and reuses the same shared cancellation endpoint/flow as every other role rather than a Driver-specific one.

**3.8 GPS tracking + map** — `useDriverLocationTracking`: 4s cadence while `ON_JOB`, 15s while `AVAILABLE`, none otherwise (client-side only — the backend enforces no cadence), one `getCurrentPosition` call per tick (not `watchPosition`) sent via the existing `SocketService` when connected, REST fallback (`PATCH /drivers/me/location`) otherwise — both funnel through the same backend `TrackingService`. Foreground-only Android permissions (`ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` — deliberately **not** `ACCESS_BACKGROUND_LOCATION`, per this phase's own scope-limiting instruction) via `PermissionsAndroid`, with check/request/blocked/settings-redirect handling and a global banner (`DriverLocationTrackingRunner`) for the denied/blocked states. `DriverJobDetailScreen` gained a `react-native-maps` `MapView` with pickup/destination markers only — no fabricated route polyline (gap #6, the backend has no route geometry).

**3.9 Profile + vehicle** — real `DriverProfileScreen` (identity, employeeId, approval chip, rating, license summary, menu to Edit/Vehicle/Documents/Notifications/Logout — mirrors the Owner `MoreScreen` pattern), real `DriverEditProfileScreen` (react-hook-form + zod against the backend's actual `updateDriverSchema` fields only — national ID/Emirates ID/driving license; name/email/phone are User-level fields with no self-service update endpoint, so intentionally not editable here), real `DriverVehicleScreen` (via `useMyAssignedVehicle`, the gap #12 best-effort workaround, with an honest on-screen note and a proper empty state for no job history).

**3.10 Documents + notifications** — new `src/api/documents.api.ts` (`GET/POST /drivers/:id/documents`, multipart upload, field name `file` — verified against `upload.middleware.ts`; no `/drivers/me/documents` shortcut exists, so the driver's own `_id` from `GET /drivers/me` is resolved first). Real `DriverDocumentsScreen`: one row per driver-relevant `DocumentType` (Emirates ID/Driving License/Passport/Profile Photo — vehicle/company document types intentionally excluded), real `DocumentVerificationStatus` chips, rejection reason shown when rejected, upload/re-upload via a newly added `react-native-image-picker` dependency (gallery picker only, no camera permission needed) — **no** verify/reject controls exposed (that's `PATCH /documents/:id/verify`, Owner-only, confirmed via `document.routes.ts`). Notifications required no new work: the shared, role-agnostic `NotificationsScreen` built in Phase 2 (`GET/PATCH /notifications`, `notification:new` socket event) was already wired into the Driver stack, dashboard bell, and profile menu.

**3.11 Earnings** — new `useDriverEarnings` hook: walks every page of `GET /jobs?status=COMPLETED` (the backend caps `limit` at 100 — utils/pagination.ts — so a driver with more completed jobs than that would otherwise be silently undercounted) and sums `finalFare ?? estimatedFare` client-side. No fabricated period breakdowns (weekly/monthly charts) — there is no backend earnings/analytics endpoint for drivers, only a single honest total plus a real completed-trips list.

**3.12 Hardening pass** — audited every Driver screen against Loading/Empty/Error/Offline/Unauthorized/Expired/Success/Disabled. All screens already had Loading/Empty/Error/Success; Unauthorized (403 ineligible-driver on accept) and Expired (410) were already handled in 3.6. The one real gap found was **Offline**: `getApiErrorMessage`'s fallback text ("Something went wrong") didn't distinguish a genuine no-connectivity axios error (no `response` at all) from a real backend failure. Fixed once, in the shared `src/api/client.ts` (new `isOfflineError` export, offline-specific fallback message) — a small, low-risk, broadly-applicable fix that improves every role's mutation error text, not a Driver-specific patch. Disabled-state coverage (buttons gated on `mutation.isPending`, duplicate-request prevention) was already correct throughout from how each screen was built in 3.1–3.11.

**3.13 Full verification** — see below.

### Files created (by area, non-exhaustive highlights)

- `src/navigation/driver/{types,DriverTabNavigator}.tsx`, rewritten `src/navigation/DriverNavigator.tsx`
- `src/api/documents.api.ts`; expanded `src/api/{drivers,jobs,client}.api.ts`/`.ts`
- `src/features/driver/{onboarding,dashboard,offers,jobs,tracking,profile,vehicle,documents,earnings,shared}/**` (screens, hooks, schemas, label maps)
- `src/features/shared/notifications/{NotificationsScreen,notificationLabels}.tsx` (moved from `owner/notifications/`, made role-agnostic)
- `__mocks__/@react-native-community/geolocation.js`, `__mocks__/react-native-image-picker.js`
- `__tests__/driver/**` (one test file per screen/hook built this phase), `__tests__/shared/notifications/**` (moved)

### Files modified

`src/api/client.ts` (added `isConflictError`/`isGoneError`/`isForbiddenError`/`isOfflineError`, offline-aware `getApiErrorMessage` fallback), `src/auth/AuthContext.tsx` (removed the now-superseded local driver-id cache call), `android/app/src/main/AndroidManifest.xml` (foreground location permissions), `src/navigation/OwnerNavigator.tsx` (import path only, for the moved shared Notifications screen), `package.json` (`@react-native-community/geolocation`, `react-native-image-picker`).

### Files deleted

`src/auth/localCache.ts` (the driver-id cache workaround — fully superseded by `GET /drivers/me`).

### Backend APIs integrated this phase

`GET /drivers/me` (new, this phase), `PATCH /drivers/me/status`, `PATCH /drivers/me/location`, `POST /jobs/:id/accept`, `POST /jobs/:id/reject`, `PATCH /jobs/:id/status` (Driver progression subset), `GET/POST /drivers/:id/documents`, `GET /jobs` (active-job lookup, jobs list, earnings aggregation), `GET /jobs/:id`, `GET /vehicles/:id` (gap #12 workaround), plus continued use of `GET/PATCH /notifications` and the shared job-cancellation endpoint from Phase 2.

### Socket events integrated

`job:new-request` (incoming offers, client-side filtered by `offeredDriverIds`), `job:accepted`/`job:status-changed` (active job detail live updates), `driver:location:update` (GPS send path, client→server), `notification:new` (already-shared Notifications screen). No new socket connections anywhere — all through the existing Phase 1 `SocketService` singleton.

### Design components reused vs added

Reused unchanged: `Button`, `TextInput`, `Card`, `Avatar`, `Header`, `BottomTabBar`, `Modal`, `LoadingState`, `EmptyState`, `ErrorState`, `IconButton`, `StatusChip`, `MetricCard`. No new shared design-system components were needed this phase — every Driver screen was buildable from the Phase 1/2 set.

### Tests added

15 new test files under `__tests__/driver/**` (registration, dashboard, status toggle, incoming offer hook + modal, jobs list, job detail, location permissions, location tracking hook, profile, edit profile, vehicle, documents, earnings hook + screen) plus 2 moved notification test files and 3 new assertions in `__tests__/api/client.test.tsx` (offline error message + `isOfflineError`). Total suite: **34 suites / 98 tests, all passing** (up from Phase 2's 19/44).

### Verification results

- `tsc --noEmit`: clean, 0 errors.
- `eslint .`: clean, 0 errors, 0 warnings.
- `jest`: 34 suites / 98 tests passing (foreground, unfiltered — the established reliable pattern in this environment).
- `gradlew assembleDebug`: **BUILD SUCCESSFUL in 4m 15s** (398 tasks: 107 executed, 291 up-to-date — confirms the two new native dependencies this phase, `@react-native-community/geolocation` and `react-native-image-picker`, compiled and linked correctly across all ABIs; everything else was correctly cached from Phase 2). Not verified: real device/emulator behavior — none available in this environment, build-only verification as agreed for every phase so far.

### Known limitations / technical debt

- `DriverVehicleScreen` shows the vehicle from the driver's most recently completed job (gap #12), not a direct "my vehicle" lookup — the backend has no such endpoint; a driver with no job history yet sees an honest empty state, not a fabricated vehicle.
- Document upload supports photo-library images only (`react-native-image-picker`, no camera capture, no PDF) — the backend also accepts `application/pdf`, but photo upload alone fully covers the identity-document use case without adding camera-permission complexity for a first pass.
- `useDriverEarnings` computes one honest lifetime total via full pagination — no weekly/monthly breakdown (no backend endpoint for that; gap tracked since Phase 0).
- Query-level (non-mutation) error screens still show a generic "Something went wrong / Retry" card rather than the new offline-specific message — only mutation-driven error text (which already threads through `getApiErrorMessage`) picked up the improvement; rewiring every query's error object into every `ErrorState` app-wide was judged out of scope for a Driver-phase hardening pass since it would touch Owner/Customer screens too.
- The same pre-existing benign Jest/React-Query `act()` console noise from Phase 2 (mutation `onSuccess` callbacks, "worker process failed to exit gracefully") appears in a couple of Driver test files too — does not fail any test, same known test-infra quirk, not a product bug.

### Backend gaps encountered

Gap #10 resolved this phase (`GET /drivers/me` added — see above). No new gaps discovered beyond gap #12 (documented already during earlier work this phase, before this session's continuation) and the already-known gap #6 (no route geometry, affects the new job-detail map).

### Next

Phase 4, per `architecture-baseline.md` §6 — recommend Customer Experience next (the third and final role), since Owner and Driver are now both complete and Customer is the only remaining gap in the core three-role model.

## Phase 4 — Customer Experience — PRE-FLIGHT AUDIT COMPLETE (2026-08-10)

**No implementation code was written this phase — audit only, per explicit instruction.** Full findings delivered as chat report; this section is the durable summary.

**Method**: re-read all six `frontend-docs/*.md` files in full; rendered the actual design HTML (`D:\MyDownloads\TezRecovery_Light__standalone_.html`, located this phase — previously undiscoverable, see below) in real Chrome via a one-off Playwright script (not a static text/PDF extraction) at a mobile viewport, captured 28 full-page scroll segments plus 6 dedicated screenshots of the page's own interactive "Customer Request Flow" widget (its 6-step `C-01`…`C-06` jump-to-step buttons — home/locate → select service → fare estimate → matching → live tracking → complete & rate); inspected the existing `admill-mobile` Customer stub (`CustomerNavigator`, `CustomerHomeScreen`, `customers.api.ts`, `useProfileStatus`, root `navigation/types.ts`) and the Owner/Driver navigation patterns to reuse; dispatched a source-verification research pass against `admill-backend` answering 10 specific questions the docs alone couldn't settle.

**Design HTML location note**: not present anywhere under `D:\Admil\**` in this environment (confirmed via full-disk search) — found at `D:\MyDownloads\TezRecovery_Light__standalone_.html`, the path recorded in `frontend-docs/PROGRESS.md`'s Phase 0 entry all along. Chrome (system-installed, `--channel chrome`) plus a scratch Playwright install were used to render it — no dependency was added to the project itself.

**Headline findings** (full detail in the chat report and `GAP-REPORT.md`):
- **New gap #13** (added to `GAP-REPORT.md`): a Customer can never see their assigned driver's name, photo, or rating — `GET /drivers/:id`/`.../ratings` have no CUSTOMER carve-out at all (403, always), and the one endpoint that does allow customer access (`.../location`) is scoped to `EN_ROUTE`/`STARTED` job status only (not `ACCEPTED`/`ARRIVED`) and returns coordinates only. Also confirmed `Customer.averageRating`/`.totalJobs` are dead schema fields, never written anywhere — do not build a profile stats card around them.
- Design's "drop-off · optional" field is reconcilable without any backend change: `POST /jobs` requires `destinationLocation` unconditionally, but there's no pickup≠destination validation and zero-distance degrades cleanly (no error) — client can default `destination = pickup` for on-site-only service types (Jump Start/Battery/Flat Tire/Fuel Delivery) rather than exposing a real optional field the backend doesn't have.
- Design's per-service-type ballpark prices and "X online now"/"X units within Y km" availability stats have no backend source and must be omitted or replaced with real data only obtainable after booking (e.g. `offeredDriverIds.length`).
- The fare-breakdown screen can use real `POST /pricing/estimate` factor data, but the "time" factor's description string is literally `"Peak-hour surcharge"`/`"Off-peak — no surcharge"` — it does **not** embed the actual window/multiplier the design shows, and Customer has no access to `GET /pricing/config` to source those numbers separately.
- `GET /services` (service catalog) has no seed mechanism anywhere in the backend — a fresh DB returns `[]` until an OWNER calls `POST /services`. Operational dependency for Phase 4.1 testing, not a code gap.
- Chat (gap #2), OTP (gap #1), and customer-owned vehicles (gap #3) all reconfirmed absent, no change from Phase 0.
- Existing reusable surface confirmed complete: `SocketService` already has all 5 events typed (`job:new-request` not needed by Customer, but `job:accepted`/`job:status-changed`/`driver:location:changed`/`notification:new` plus `subscribeToJob()` all ready as-is), `listJobs`/`getJobById`/`cancelJob` in `jobs.api.ts` already reusable verbatim, `RegisterScreen` already supports the CUSTOMER role. Missing and net-new for Phase 4.1: `createJob`/`rateJob` in `jobs.api.ts`, a new `services.api.ts`, `estimateFare` in `pricing.api.ts`, a full `Customer` entity type (current `CustomerProfileSummary` is Phase-1-minimal), `src/navigation/customer/{types,CustomerTabNavigator}.tsx` + a rewritten `CustomerNavigator.tsx` (mirrors the Driver Phase 3 pattern exactly — root `navigation/types.ts`'s `CustomerTabParamList` is the Phase 1 original, never migrated), and one new shared component (a tappable star-rating input — nothing like it exists yet).
- Confirmed design tokens directly from the rendered page (not re-derived): Amber `#F5A623`, Canvas `#F4F2EE`, Ink `#14161A` all match the current `tokens.ts` exactly (already correct since Phase 1). Newly confirmed and not yet in `tokens.ts`: full type scale (Display 34/700, Title 24/600, Headline 17/600, Body 15/1.45/400, Caption 13/500, Overline 11 mono) and the glass-card elevation spec (L1 white 92→72% gradient, blur 24, 1px ink-10% hairline) — recommend refining `tokens.ts` at the start of Phase 4.1 implementation.

**Not done yet (by design)**: no Customer screens, no navigation rewrite, no new API functions, no new components. Awaiting review/approval of the full audit before Phase 4.1 begins.

### 4.1 Navigation/shell — COMPLETE (2026-08-10)

Audit approved; implementation started. This sub-phase only restructures navigation — no API/backend work, no real screen content (deferred to their own sub-phases per the approved plan).

**Files created**: `src/navigation/customer/{types,CustomerTabNavigator}.tsx`; stub screens `src/features/customer/{home/CustomerHomeScreen,jobs/CustomerJobsScreen,jobs/CustomerJobDetailScreen,profile/CustomerProfileScreen,profile/CustomerEditProfileScreen,request/ServiceSelectionScreen,request/FareEstimateScreen,matching/FindingDriverScreen}.tsx`; `__tests__/customer/navigation/CustomerNavigator.test.tsx`.

**Files modified**: `src/navigation/CustomerNavigator.tsx` (rewritten: profile-gate unchanged for `loading`/`no-profile` — still the generic `ProfileIncompleteScreen`, real onboarding form is 4.2 — `ready` branch now a `Stack.Navigator` hosting `CustomerTabNavigator` plus pushed screens `JobDetail`/`Notifications`/`EditProfile`, and a modal `Stack.Group` for `ServiceSelection`/`FareEstimate`/`FindingDriver` per the design's own "request flow is a modal stack over Home, never a tab" note); `src/navigation/types.ts` (removed `OwnerTabParamList`/`DriverTabParamList`/`CustomerTabParamList` — confirmed via repo-wide grep that nothing imported any of the three anymore, all superseded by each role's own `navigation/{owner,driver,customer}/types.ts`; only `AuthStackParamList` remains, which is still live).

**Files deleted**: `src/features/customer/CustomerHomeScreen.tsx` (moved to `src/features/customer/home/CustomerHomeScreen.tsx` for folder-per-feature consistency with Driver's convention; content unchanged, still the Phase 1 placeholder).

**Design decisions made this sub-phase** (informing all later Customer sub-phases, so recording the reasoning now): `CustomerJobDetailScreen` will conditionally render active-tracking (4.8), history-detail (4.9), and post-completion rating (4.10) content based on `job.status` — one screen, not three, mirroring `DriverJobDetailScreen`'s existing conditional-controls pattern and satisfying the Phase 4 approval's instruction #5 against unnecessary screen proliferation. `FareEstimateScreen` will own the `POST /jobs` submit action directly (4.6 "job creation" is a mutation inside it, not a separate route) — already reflected in `CustomerStackParamList` having no separate job-creation screen. Tab bar is 3 tabs (Home/Trips/Profile), not the design's literal 4 (Chat omitted — gap #2, no backend).

**APIs/sockets integrated**: none — pure navigation scaffolding.

**Tests added**: 5, in `__tests__/customer/navigation/CustomerNavigator.test.tsx` — loading state, no-profile state (shows `ProfileIncompleteScreen`, not the tab shell), ready state renders all 3 tabs, explicit navigation-isolation assertions (no Owner text like "Fleet"/"Command Dashboard", no Driver text like "Go Online"/"Earnings" ever renders for a CUSTOMER session), and tab-switching (Trips/Profile) actually changes rendered content.

**Verification results**: `tsc --noEmit` clean · `eslint .` clean, 0 warnings · `jest` — **35 suites / 103 tests, all passing** (up from Phase 3's 34/98; +1 suite/+5 tests, zero regressions — Owner's 19 suites and Driver's 15 all still pass unchanged). Android build not run this sub-phase (no new native dependency, deferred to 4.14 per the approved plan).

**Limitations/gaps discovered this sub-phase**: none new — pure scaffolding surfaced nothing the preflight audit hadn't already found.

**Next**: 4.1 verified and safe. Proceeding to 4.2 (Customer onboarding/profile) only after this update is reported and no regression is found.

### 4.2 Customer onboarding/profile — COMPLETE (2026-08-10)

Re-verified the Customer backend contract directly against source before writing any code (`customer.routes.ts`, `.validator.ts`, `.service.ts`, `.repository.ts`, `interfaces/customer.interface.ts`) rather than trusting the preflight audit's memory of it — confirmed exactly: `POST /customers` and `PATCH /customers/me` both accept only `{nationalId (required, min 1), address? (optional, min 1 if present)}`; `POST /customers`' response is **not** identity-populated (`register()` returns the raw `create()` result, unlike `getMyProfile`/`updateMyProfile` which both call `findByIdWithIdentity`); `ICustomer`'s `averageRating`/`totalJobs` fields exist on the schema but are never written anywhere (repo-wide grep, zero write sites) — confirmed dead, per gap #13.

**Files created**: `src/features/customer/onboarding/{schemas,CustomerRegistrationScreen}.tsx`; `__tests__/customer/onboarding/CustomerRegistrationScreen.test.tsx`; `__tests__/customer/profile/{CustomerProfileScreen,CustomerEditProfileScreen}.test.tsx`.

**Files modified**: `src/types/entities.ts` (removed the Phase-1-minimal `CustomerProfileSummary`, added a full `Customer` interface — deliberately excludes `averageRating`/`totalJobs` entirely rather than including-but-warning-against them, so nothing in the UI can accidentally bind to a field that's never real; widened `isPopulatedIdentity`'s parameter type from `Driver['userId']` to `string | PopulatedIdentity` so it's genuinely shared rather than Driver-named — zero behavior change, Driver's own usage is unaffected); `src/api/customers.api.ts` (rewritten against `Customer`, renamed `createCustomerProfile`→`registerCustomerProfile`/`CreateCustomerPayload`→`RegisterCustomerPayload` to match Driver's naming convention, added `updateMyCustomerProfile`); `src/navigation/CustomerNavigator.tsx` (`no-profile` branch now renders the real `CustomerRegistrationScreen` instead of the generic `ProfileIncompleteScreen`); `src/features/customer/profile/{CustomerProfileScreen,CustomerEditProfileScreen}.tsx` (real content, replacing 4.1's stubs); `__tests__/customer/navigation/CustomerNavigator.test.tsx` (no-profile test now asserts the real form renders; Profile-tab-switch test now mocks `GET /customers/me`+`GET /jobs` and asserts real content, since the stub text it previously checked no longer exists).

**Files deleted**: none this sub-phase (4.1 already moved/deleted the old `CustomerHomeScreen.tsx` path).

**APIs integrated**: `POST /customers`, `GET /customers/me` (already wired since Phase 1 via `useProfileStatus`, now also consumed directly by the Profile/Edit screens), `PATCH /customers/me`. `GET /jobs?status=COMPLETED&limit=1` reused (no new wrapper — `listJobs` already existed) to derive a real "completed trips" count for the Profile screen instead of trusting the dead `totalJobs` field.

**Socket events integrated**: none (not relevant to this sub-phase).

**Design elements implemented**: registration form (design has no literal onboarding screen for this — built from the two accepted backend fields, headline copy reused from the prior placeholder's wording); profile screen mirrors design C-10's identity block and the audit's own recommendation (jobs count real, rating/vehicles/payment/emergency-contact/language all omitted — dead field, gap #3, and out-of-scope respectively).

**Tests added**: 16 across 4 files — registration (exact payload incl. address-omission-when-blank, validation error, 409-duplicate), profile display (real data rendering, "Not provided" for absent address, error state), edit-profile (pre-fill, exact PATCH payload, backend error message, error state), plus 2 updated navigator tests (real-form assertion, real Profile-tab content assertion).

**Verification results**: `tsc --noEmit` clean · `eslint .` clean, 0 warnings · `jest` — **38 suites / 114 tests, all passing** (up from 4.1's 35/103; +3 suites/+11 tests, zero regressions — Owner's 19 suites and Driver's 15 both still pass unchanged). Android build not run (no new native dependency).

**Limitations/gaps discovered this sub-phase**: none new — every finding matched the Phase 4 preflight audit exactly, nothing further to add to `GAP-REPORT.md`.

**Next**: 4.2 verified and safe. Awaiting approval before 4.3 (Customer Home).

---

**Batch approval received (2026-08-10) to complete 4.3–4.14 sequentially without per-sub-phase gating.** One significant new finding surfaced immediately, documented before any further code was written:

### New: GAP-REPORT.md gap #14 — job creation is genuinely blocked (initial finding corrected during 4.5/4.6 — see full writeup below)

Initial finding (before 4.5 implementation): `POST /jobs` requires a `companyId`, and there is no company-listing endpoint anywhere, only `GET /companies/lookup/:companyCode`. First proposed resolution — reuse that lookup endpoint to resolve `companyCode → companyId` — **was verified against `company.service.ts`'s `lookupByCode` during 4.5 and found not to work**: that endpoint deliberately returns only `{companyCode, companyName, logo, city}`, never `_id`. There is no legitimate way to obtain a `companyId` as a Customer anywhere in the current backend. This is a genuine, complete blocker for `POST /jobs` specifically — not a workaround-able gap. See the corrected, full gap #14 writeup under 4.5/4.6 below and in `GAP-REPORT.md`.

### 4.3 Customer Home — COMPLETE (2026-08-10)

**Backend capabilities used**: `GET /jobs` only (already-existing `listJobs`, no changes) — Home shows a real active-job card (broadened to include `PENDING`, unlike Driver's active-job definition, since a customer's own just-created job is meaningfully "active" to them while still matching) or a "Request Recovery" entry point when none exists. No new endpoints.

**Files created**: `src/features/customer/shared/useMyActiveJob.ts` (Customer's own version — broader status set than Driver's, kept separate rather than shared, matching the existing per-role convention); `src/api/services.api.ts` (added ahead of 4.4 since it's a one-line reusable wrapper — see 4.4 below for actual usage); `__tests__/customer/home/CustomerHomeScreen.test.tsx`.

**Files modified**: `src/features/customer/home/CustomerHomeScreen.tsx` (real content replacing 4.1's stub — `react-native-maps` background at a static default Dubai region, deliberately **not** requesting location permission on Home since nothing here functionally needs real GPS yet; notification bell reusing `useUnreadNotificationCount`; active-job card or request-entry-point card, no fabricated "X online now"/availability stats per the audit).

**Tests added**: 3 — request-entry-point shown with no fabricated stats present, active-job card shown instead (including the `PENDING` case), error state on failure.

**Verification**: `eslint .` clean · `jest __tests__/customer/home` — 3/3 passing. (Full-suite/tsc verification deferred to natural sub-phase-boundary checkpoints given the batch-approval instruction to move continuously; still run before advancing each sub-phase, just reported together at coarser intervals than 4.1/4.2 to match the pace requested.)

**Limitations/gaps discovered**: gap #14 (above) — discovered here, resolved architecturally before 4.4 began.

### 4.4 Service Selection — COMPLETE (2026-08-10)

**Backend capabilities used**: `GET /services` (re-verified `service.repository.ts`'s `findAll` — plain `{isDeleted:false}` query, confirmed **no server-side `isAvailable` filter**, matching the audit; client filters it before rendering). Real `displayName`/`description`/`baseFare` per catalog entry — no hardcoded 8-row design list.

**Files created**: `src/api/services.api.ts` (`AppService` type, `listServices`); `src/features/customer/request/ServiceSelectionScreen.tsx` (real, replacing 4.1's stub); `__tests__/customer/request/ServiceSelectionScreen.test.tsx`.

**Tests added**: 4 — real catalog rendering with unavailable-entry filtering, empty state, error state, navigation to FareEstimate on tap.

**Verification**: `tsc --noEmit` clean · `eslint .` clean · new suite 4/4 passing.

### Shared-infra change: `locationPermissions.ts` promoted to `src/utils/`

**Why**: Customer's fare-estimate screen (4.5, next) needs one-shot pickup-location capture, requiring the same Android permission check/request/blocked handling Driver's continuous GPS tracking already built in Phase 3. The existing module (`src/features/driver/tracking/locationPermissions.ts`) was pure permission-handling infra with zero Driver-specific logic — moving it to `src/utils/` avoids a cross-role import (`customer/** → driver/**`) and avoids duplicating ~40 lines.

**Files created**: `src/utils/locationPermissions.ts` (identical logic; generalized the permission-request dialog's message string from Driver-specific wording to a neutral one — the only text/behavior change).

**Files deleted**: `src/features/driver/tracking/locationPermissions.ts`.

**Files modified**: `src/features/driver/tracking/{useDriverLocationTracking,DriverLocationTrackingRunner}.tsx` (import path only, zero logic change).

**Tests moved**: `__tests__/driver/tracking/locationPermissions.test.ts` → `__tests__/utils/locationPermissions.test.ts` (content unchanged beyond the import path); `__tests__/driver/tracking/useDriverLocationTracking.test.tsx`'s `jest.mock` path updated to match.

**Regression verification**: `tsc --noEmit` clean · both the relocated test (5/5) and Driver's `useDriverLocationTracking` test (3/3) pass unchanged at their new/updated paths — confirms Driver's GPS tracking behavior is byte-for-byte unaffected by the move.

### 4.5 + 4.6 Fare Estimate + Job Creation — COMPLETE, with one action intentionally disabled (2026-08-10)

**Backend capabilities used**: `POST /pricing/estimate` — re-verified directly against `pricing.validator.ts`/`pricing.service.ts`/`factors/*.ts`: request is bare `{serviceType, pickupLocation:GeoPoint, destinationLocation:GeoPoint}` (**not** the `{geo,address}` shape `POST /jobs` uses — a real difference between the two endpoints, now correctly reflected as two distinct location types in the API layer), response `{serviceType,distanceKm,durationMinutes,factors:[{name,amount,description}],total}`. Confirmed exact factor `description` strings for all 6 active factors (Base/Distance/Fuel/Weather/Time/Demand) — notably `time`'s description is literally `"Peak-hour surcharge"`/`"Off-peak — no surcharge"` with no window/multiplier numbers embedded, so the screen renders the real string as-is rather than fabricating detail the backend doesn't return. `POST /jobs` — implemented and correctly typed, but **its call site is intentionally disabled in the UI** (see gap #14 below).

**Blocker found and resolved architecturally — see corrected `GAP-REPORT.md` gap #14**: `POST /jobs` requires a real `companyId`; there is no legitimate way for a Customer to obtain one (the one company-lookup endpoint reachable by non-owners deliberately never returns `_id`, confirmed via direct source read of `company.service.ts`). This blocks job creation specifically, not the rest of the flow. Resolution: built the full fare-estimate experience (real GPS pickup, real map-tap destination, real live pricing breakdown) as genuinely functional, and kept the "Request Recovery" submit action visibly present but disabled with an explicit on-screen explanation, rather than fabricating a companyId or omitting the screen.

**Location capture (no external APIs — reused already-installed dependencies only)**: pickup via one-shot `Geolocation.getCurrentPosition` (`@react-native-community/geolocation`, already installed for Driver in Phase 3) gated by the newly-shared `utils/locationPermissions.ts`; destination via native `MapView.onPress` tap-to-pin (`react-native-maps`, already installed) for towing service types (`CAR_TOWING`/`BOX_RECOVERY`/`BIKE_TOWING`), auto-defaulted to the same point as pickup for on-site-only service types (`JUMP_START`/`BATTERY_REPLACEMENT`/`FLAT_TIRE_REPLACEMENT`/`FUEL_DELIVERY`) — verified directly against `job.validator.ts` that the backend has no pickup≠destination check and a zero-distance job prices cleanly (no error), so this default is technically sound, not a guess.

**Files created**: `src/features/customer/request/onSiteServiceTypes.ts`; `__tests__/customer/request/FareEstimateScreen.test.tsx`.

**Files modified**: `src/api/pricing.api.ts` (added `estimateFare`, `EstimateFarePayload`/`FareBreakdown`/`FareFactor` types); `src/api/jobs.api.ts` (added `createJob`/`CreateJobPayload` — implemented correctly, not called from any screen yet); `src/features/customer/request/FareEstimateScreen.tsx` (real, replacing 4.1's stub).

**Tests added**: 5 — permission-denied state, permission-blocked state (corrected mid-writing to reflect the real `checkLocationPermission` can only ever return granted/denied, never blocked — only `requestLocationPermission`'s dialog result can), on-site auto-default-destination + real breakdown rendering, towing map-tap-required flow, and an explicit assertion that `POST /jobs` is never called and the disabled explanation is always shown.

**Verification**: `tsc --noEmit` clean · `eslint .` clean · new suites 9/9 passing · **full suite 41 suites / 126 tests, all passing** (up from 4.4's 39/121 — +2 suites/+9 tests; Owner 19 and Driver 15 both unchanged).

**Limitations/gaps discovered**: gap #14, corrected and finalized (see above and `GAP-REPORT.md`) — job creation is blocked pending a real backend fix, not a frontend shortfall.

### 4.7 Finding Driver / Matching — COMPLETE, but not reachable end-to-end from Home in this environment (2026-08-10)

**Built fully and correctly** against a real `jobId` (navigation param) — same caveat as everything downstream of 4.6: since no job can actually be created through the live UI (gap #14), this screen cannot be reached by tapping through from Home today. It is fully implemented and unit-tested against realistic backend payloads/socket events, ready to work the moment gap #14 is fixed or a job otherwise exists.

**Backend/socket capabilities used**: `GET /jobs/:id` (initial state + the job's real `expiresAt`), `SocketService.subscribeToJob` (`job:subscribe`), `job:accepted`/`job:status-changed` listeners. Genuine indeterminate "Finding your driver..." state — no sequential per-driver animation, no candidate name/photo/rating shown (gap #13), no fabricated "X nearby drivers" count.

**Expiry handling (no fabrication)**: `PENDING→EXPIRED` is lazy on the backend with no dedicated socket event (`JOB-LIFECYCLE.md`, re-confirmed) — rather than polling, this screen counts down to the job's own real `expiresAt` timestamp (already returned by `GET /jobs/:id`) and treats reaching it as the honest "stop waiting" signal, using the backend's own committed value rather than a guessed client-side timeout.

**Files modified**: `src/features/customer/matching/FindingDriverScreen.tsx` (real, replacing 4.1's stub).

**Tests added**: 6 (`__tests__/customer/matching/FindingDriverScreen.test.tsx`) — subscribes on mount + indeterminate state (with an explicit assertion that no fabricated "driver 1/2/3" sequential text exists), navigates to JobDetail on `job:accepted` for this job, correctly ignores `job:accepted` for a *different* job, real-`expiresAt`-driven timeout state, cancel-while-waiting success (asserting the exact `cancellationReason` payload), error state on load failure.

**Verification**: `tsc --noEmit` clean · full suite **42 suites / 132 tests, all passing** (a filtered `npx jest __tests__/customer/matching` run hung in this sandbox — the same previously-documented environment quirk, not a code issue; confirmed by the full unfiltered run completing normally in 12s per the established workaround).

**Limitations**: not exercisable end-to-end from Customer Home pending gap #14's resolution — verified in isolation instead.

### 4.8 Active Job / Live Tracking — COMPLETE, plus 4.10 Rating/Cancellation folded in (2026-08-10)

**Scope note**: rating and cancellation ended up implemented as sections *within* `CustomerJobDetailScreen` while building 4.8 (the screen already needed to render every job status, and rating/cancellation are themselves status-conditional sections of the same screen — splitting them into a separate 4.10 pass would have meant re-opening and re-verifying the same file for no architectural benefit, contrary to instruction #5's "don't create separate work merely to satisfy the numbering"). 4.10 in the sub-phase list below is therefore a verification/confirmation step, not new implementation.

**Also fixed while building this**: `CustomerHomeScreen`'s active-job card routed *every* status to `JobDetail`, including `PENDING` — inconsistent with 4.7's `FindingDriverScreen` existing specifically for the pre-match state. Fixed to route `PENDING` → `FindingDriver`, everything else → `JobDetail` (button label also now "View request" vs "View trip" accordingly). One existing 4.3 test updated to match; a new test added for the accepted-job case.

**Backend/socket capabilities used**: `GET /jobs/:id`, `job:subscribe`, `job:status-changed`/`job:accepted` (refetch on change — REST stays the source of truth, socket only triggers the refetch, same pattern as every other role's screens). `GET /drivers/:id/location` (new `getDriverLocation` wrapper) as the initial snapshot, gated to `EN_ROUTE`/`STARTED` only (re-verified against `tracking.service.ts`'s `assertCanViewDriverLocation` — narrower than "non-terminal", confirmed precisely: `ACCEPTED`/`ARRIVED` do **not** get a location, gap #13) + `driver:location:changed` for live updates thereafter. `PATCH /jobs/:id/status` (cancel, shared function, reused verbatim). `POST /jobs/:id/rating`.

**No driver identity anywhere** (gap #13, enforced in this screen): no name, photo, rating, or call/message control — only a generic "Your driver" marker on the map.

**Rating handling without a backend "already rated" flag**: `Job` has no field indicating whether it's been rated. The rating form renders for any `COMPLETED` job; a `409` on submit (the backend's real, correct signal for "already rated" — confirmed via `rating.service.ts`'s unique-index-backstop) is treated as an informational "Thanks — you've already rated this trip" state, not a generic error — using the real backend signal correctly rather than fabricating a client-side "isRated" flag.

**Cancellation UX**: differentiated confirmation copy for `PENDING` ("Cancel this recovery request?") vs already-accepted (`ACCEPTED`/`EN_ROUTE`/`ARRIVED`/`STARTED` — "A driver has already been assigned to this job. Are you sure you want to cancel?"), same shared `cancelJob` call either way, required non-empty reason enforced client-side (backend also enforces it via Zod `.refine()`).

**Files created**: `src/components/StarRatingInput.tsx` (new shared component, exported from `src/components/index.ts` — generic 1-5 tap input, no rating-tags concept since none exists server-side); `__tests__/customer/jobs/CustomerJobDetailScreen.test.tsx`.

**Files modified**: `src/api/drivers.api.ts` (added `getDriverLocation`/`DriverLocationResult`); `src/api/jobs.api.ts` (added `rateJob`/`RateJobPayload`/`Rating`); `src/features/customer/jobs/CustomerJobDetailScreen.tsx` (real, replacing 4.1's stub); `src/features/customer/home/CustomerHomeScreen.tsx` (PENDING routing fix above); `__tests__/customer/home/CustomerHomeScreen.test.tsx` (updated + 1 new test for the routing fix).

**Tests added**: 10 in `CustomerJobDetailScreen.test.tsx` (error state, location hidden while `ACCEPTED`, location shown + live-updated while `EN_ROUTE`, cancellation copy for both cases, cancellation payload, terminal job hides cancel, rating submit + real payload + post-submit ack, `409`→"already rated" (not a generic error), no rating section for a non-completed job) + 1 new/1 updated in `CustomerHomeScreen.test.tsx`.

**Verification**: `tsc --noEmit` clean · `eslint .` clean · **full suite 43 suites / 143 tests, all passing** (one pre-existing `CustomerHomeScreen` test needed updating for the intentional routing-copy change — not a regression, an expected consequence of the fix, corrected in the same commit).

### 4.9 Job History / Details — COMPLETE (2026-08-10)

**Backend capabilities used**: `GET /jobs` (already-existing `listJobs`, reused verbatim), client-side status filtering into Active (`PENDING`/`ACCEPTED`/`EN_ROUTE`/`ARRIVED`/`STARTED`) / History (`COMPLETED`/`CANCELLED`/`EXPIRED`) tabs — same segmented-list pattern as Driver's own Jobs screen. Tapping a row routes `PENDING` → `FindingDriver`, everything else → `JobDetail` (same routing fix as 4.8's Home card). No receipt/PDF (gap #5) — each row shows real `finalFare ?? estimatedFare` only.

**Files modified**: `src/features/customer/jobs/CustomerJobsScreen.tsx` (real, replacing 4.1's stub); `__tests__/customer/navigation/CustomerNavigator.test.tsx` (Trips-tab test updated to mock real data instead of the old stub text, same pattern as 4.2's/4.8's fixes).

**Tests added**: 4 (`CustomerJobsScreen.test.tsx`) — Active tab includes `PENDING`, History tab shows completed jobs with real fare, empty state, error state.

**Verification**: `tsc --noEmit` clean · `eslint .` clean · **full suite 44 suites / 147 tests, all passing**.

### 4.10 Rating / Cancellation — VERIFIED COMPLETE (built during 4.8, no new work)

Both fully implemented as sections of `CustomerJobDetailScreen` (real `POST /jobs/:id/rating`, real shared `cancelJob`, differentiated confirmation copy, `409`-as-"already rated" handling, `StarRatingInput` component) — see 4.8's entry above for the full writeup and the 10 tests covering this behavior. Nothing further needed.

### 4.11 Notifications — VERIFIED COMPLETE (fully reused, no new work)

Confirmed both entry points are wired: `CustomerHomeScreen`'s header bell (`useUnreadNotificationCount` + navigate to `Notifications`, built in 4.3) and `CustomerProfileScreen`'s "Notifications" menu item (built in 4.2) both route to the shared, role-agnostic `NotificationsScreen` (`GET/PATCH /notifications`, `notification:new` socket event) already wired into `CustomerNavigator`'s stack since 4.1. No second notification system, no bulk mark-all-read (matches the backend's real capability — same omission Owner/Driver already made). Nothing to build.

### 4.12 Profile / Settings — VERIFIED COMPLETE (built in 4.2, no new work)

`CustomerProfileScreen`/`CustomerEditProfileScreen` (4.2) already expose exactly the backend-supported fields (`nationalId`, `address`) plus real identity (name/email/phone) and a real derived completed-trips count — no vehicles/payment methods/emergency contact/language/rating (gap #3 and dead-field omissions, per the preflight audit). Nothing further needed.

### 4.13 Hardening pass — COMPLETE, no code changes required (2026-08-10)

Systematically audited every Customer screen against Loading/Empty/Error/Offline/Unauthorized/Expired/Success/Disabled, plus the specific edge-case list from the Phase 4 approval (race conditions, socket cleanup, navigation isolation, stale data, mutation failures, 401/403/404/409/410/429, duplicate submissions, cancellation/matching/rated-job edge cases, unmount cleanup, Owner/Driver regressions):

- **All 8 states**: confirmed present on every screen built this phase (Home/ServiceSelection/FareEstimate/FindingDriver/JobDetail/Jobs/Profile/EditProfile/Registration) — each already had explicit Loading/Empty/Error handling built in from its own sub-phase, not retrofitted here.
- **Offline**: automatically covered — every mutation already routes errors through `getApiErrorMessage`, which gained offline-specific wording during Driver's 3.12 hardening pass (`isOfflineError`) and Customer screens inherit it for free, no new code needed. Query-level (non-mutation) `ErrorState`s still show the same generic "Something went wrong" as every other role's screens — a pre-existing, already-documented, accepted limitation (Driver 3.12), not new to Customer.
- **Disabled/duplicate-submission guards**: verified present on every mutation button (`FareEstimate`'s booking button permanently disabled by design; `FindingDriver`'s/`JobDetail`'s cancel buttons disabled while their mutation is pending; rating submit disabled until a star is chosen and while pending; registration/edit-profile submits disabled while pending) — all pre-existing from each screen's own construction, confirmed not missing anywhere.
- **Stale data / cache invalidation**: verified every mutation that changes a job (`cancelJob` in both `JobDetail` and `FindingDriver`, `rateJob`) invalidates the broad `['jobs']` key, which correctly cascades (React Query prefix matching) to Home's active-job check, the Trips list, and any open `JobDetail` query — no stale-screen gap found.
- **403/409 handling**: driver-location's expected 403 outside the `EN_ROUTE`/`STARTED` window degrades silently to "no marker shown" (never surfaced as a scary error, matches the client-side gating that mostly prevents the call in the first place); rating's 409 is deliberately treated as "already rated" (4.8), not a generic failure.
- **Socket cleanup / duplicate listeners**: `useSocketEvent`'s existing cleanup (`SocketService.off` on unmount) is unchanged shared infra; Customer's usage matches the exact pattern already established and accepted in Driver's `DriverJobDetailScreen` (inline handler re-subscribing per render is pre-existing, accepted codebase style, not a new issue).
- **Navigation isolation**: already explicitly tested in `CustomerNavigator.test.tsx` since 4.1 (no Owner/Driver text ever renders for a CUSTOMER session) — re-confirmed still passing.
- **Owner/Driver regressions**: full suite re-run (below) — both unchanged at 19 and 15 suites respectively throughout every Customer sub-phase.

**No code changes were required by this pass** — every gap that hardening passes typically catch had already been built correctly into each screen as it was written, sub-phase by sub-phase, rather than deferred. Verification: `tsc --noEmit` clean · `eslint .` clean · full suite unchanged at 44 suites / 147 tests.

### 4.14 Full Verification — COMPLETE (2026-08-10)

- `tsc --noEmit`: clean, 0 errors.
- `eslint .`: clean, 0 errors, 0 warnings.
- `jest`: **44 suites / 147 tests, all passing** (up from Phase 3's 34/98 — Phase 4 added 10 suites/49 tests; Owner's 19 suites and Driver's 15 suites both unchanged throughout every sub-phase).
- `gradlew assembleDebug`: **BUILD SUCCESSFUL in 24s** (398 tasks: 24 executed, 374 up-to-date — confirms Phase 4 added zero new native dependencies, everything reused from Phase 2/3's already-compiled native modules).
- No undocumented backend changes (none were made at all this phase — Phase 4 is frontend-only; the one backend change in this project's history remains Phase 3's `GET /drivers/me`).
- No fabricated functionality anywhere (verified throughout: gap #13's driver-identity omission, gap #14's disabled booking action, gap #2/#1/#3/#5's omissions all held to the end).

Phase 4 (Customer Experience) is complete. See the separate end-of-phase completion report for the full 21-section breakdown.

### Post-Phase-4 — Gap #14 resolved, Customer booking fully re-enabled (2026-08-10)

**Root cause**: `POST /jobs` required a `companyId` that no Customer could legitimately obtain — no company-discovery endpoint exists, and `GET /companies/lookup/:companyCode` deliberately never returns `_id`. Documented in full in `frontend-docs/GAP-REPORT.md` gap #14 and investigated architecturally at the end of Phase 4; the booking button shipped permanently disabled as a result.

**Resolution (backend)**: `POST /jobs` no longer accepts or requires `companyId` at all — the backend now resolves the platform's single operational company server-side via a `DEFAULT_COMPANY_CODE` env var + `CompanyRepository.findByCompanyCode()`, mirroring the existing `POST /drivers` resolution pattern. Missing/misconfigured company → `500` with a safe, generic message (never exposed to the Customer, never a `400`/`404` since the Customer didn't cause the problem). Full backend-side change log lives in `admill-backend/src/docs/PROGRESS.md`'s own Gap #14 entry; not duplicated here since this repo doesn't own that code.

**Resolution (mobile)**: `CreateJobPayload` (`src/api/jobs.api.ts`) dropped the `companyId` field — the Customer app now has zero company concept anywhere, matching the product design exactly. `FareEstimateScreen` (`src/features/customer/request/FareEstimateScreen.tsx`) fully re-enabled: the permanently-disabled button and "booking unavailable" explanatory card are gone, replaced by a real `useMutation`-backed `createJob()` call using only the new minimal body (`serviceType`, `pickupLocation`, `destinationLocation`). On success, navigates (`replace`, not `navigate`) to the existing `FindingDriver` screen using the real returned `job._id` — no fabricated driver/ETA/matching data. On error, reuses the existing `getApiErrorMessage` helper (offline wording included, inherited for free from Driver's earlier 3.12 hardening). Duplicate submission guarded by `createJobMutation.isPending` gating both `disabled` and effectively no-op repeated presses.

**Files modified**: `src/api/jobs.api.ts` (`CreateJobPayload`), `src/features/customer/request/FareEstimateScreen.tsx` (full re-enable), `__tests__/customer/request/FareEstimateScreen.test.tsx` (reworked — see below).

**Tests**: replaced the old single "always disabled" test with 8 new tests — successful submission with an exact-payload assertion (`companyId` explicitly `undefined`) + navigation to `FindingDriver`; in-flight loading state (no navigation until the request resolves); duplicate-submission prevention (3 presses → exactly 1 `POST /jobs`); `500`/`404`/`429` real-backend-message display without navigating; offline `networkError()` handling; button ignores presses until the fare estimate has actually loaded. Full suite: **44 suites / 154 tests, all passing** (up from Phase 4's close of 44/147 — this pass replaced 1 test with 8, net +7).

**Verification**: `tsc --noEmit` clean · `eslint .` clean, 0 warnings · `jest --watchAll=false --ci`: 44 suites / 154 tests, all passing · `gradlew assembleDebug`: see final implementation report for this task.

**Owner/Driver regression**: none — no Owner or Driver file touched; Owner (19 suites) and Driver (15 suites) counts unchanged throughout.

**Remaining limitation (unchanged from the architectural analysis)**: this is a single-operational-company simplification, not real multi-company support. Customer-facing company selection/discovery is intentionally still not implemented. A future multi-company platform would require server-side company matching/routing based on real company coverage/geographic data — a separate, not-yet-scoped architectural change. See `frontend-docs/GAP-REPORT.md` gap #14 for the full writeup.

### Presentation readiness — real-device install fix (2026-08-10)

**Discovered by**: installing the previous session's debug APK on a real phone and hitting `Unable to load script — make sure you are running Metro`.

**Root cause**: a debug-variant Android build doesn't embed the JavaScript bundle — it fetches it live from a Metro dev server at runtime. That only works tethered to (or configured to reach) a running `npx react-native start` process; installed standalone on a phone with no Metro reachable, it can never load. This is standard React Native behavior, not a defect in this codebase — the fix is to use a **release** build for a standalone demo device instead, since release builds bundle the JS ahead of time via Gradle.

**Building a release APK surfaced two further, real, previously-latent bugs** — neither was ever exercised before, since nothing in this project had ever run a full release bundle until now:
1. `createBundleReleaseJsAndAssets` failed outright: `zod`'s v4 ESM build (`node_modules/zod/v4/classic/external.js`) uses `export * as ns from '...'`, which requires `@babel/plugin-transform-export-namespace-from` — present in `node_modules` as a transitive dependency, but never wired into `babel.config.js`. Fixed by adding it to the `plugins` array (one line, no new package install).
2. Android's `release` build type sets `android:usesCleartextTraffic="false"` automatically (via the React Native Gradle plugin), which blocks all plain-HTTP traffic — `admill-backend` has no TLS set up in this development/demo environment (`http://<host>:5000`), so a release APK would have installed fine and then silently failed every single API/socket call. Fixed with a `network_security_config.xml` (`<base-config cleartextTrafficPermitted="true">`) referenced from `AndroidManifest.xml` — takes precedence over the manifest attribute, applies to both build types, doesn't touch anything else about the app's security posture.

**Also updated for the actual demo network**: `.env`'s `API_BASE_URL`/`SOCKET_URL` changed from `10.0.2.2` (Android emulator-only alias) to the demo machine's real LAN IP, since the target device is a physical phone, not an emulator. Confirmed (not assumed) Windows Firewall already has inbound-allow rules for `node.exe` on Private/Public profiles covering any port — no firewall changes were needed.

**Files created**: `android/app/src/main/res/xml/network_security_config.xml`.

**Files modified**: `babel.config.js` (added the missing plugin), `android/app/src/main/AndroidManifest.xml` (references the new network security config), `.env` (LAN IP instead of the emulator alias — gitignored, not tracked).

**Verification**: `tsc --noEmit` clean · `eslint .` clean · `jest --watchAll=false --ci`: 44 suites / 154 tests, all passing (one transient timeout on the first post-change run, traced to CPU contention with a concurrent Gradle build running at the same time — re-ran clean on its own immediately after, not a real regression) · `gradlew assembleRelease`: **BUILD SUCCESSFUL** (first attempt failed on the zod/Babel issue above; second attempt, after the fix, succeeded — `app-release.apk`, ~79MB) · `gradlew assembleDebug`: **BUILD SUCCESSFUL**, unaffected by the manifest/network-config change (398 tasks, 40 executed, 358 up-to-date).

**Not touched**: backend (no changes needed — this was entirely an Android/build-configuration issue), any other mobile source file, architecture, or product behavior.

**Remaining limitation**: the on-device UI walkthrough with the new release APK has not been physically re-verified after this fix (no device/emulator available in the dev environment) — verify by installing `app-release.apk` on the actual demo phone before presenting.

### QA audit finding #1 fixed — real FCM push notifications wired end-to-end at the source/build level (2026-08-11/12)

**Discovered by**: a full QA pass across every screen/flow (this session), cross-checked against a background agent's independent mobile-API-vs-backend-contract audit. Both found the same thing: the backend (`notification.service.ts`, `firebase.provider.ts`, `deviceToken.*`) has always fully implemented FCM push — real credentials configured, real send path — but the mobile app never integrated any Firebase/push SDK and never called `POST /device-tokens`, so `DeviceTokenRepository.findByUserId` always returned empty and `pushProvider.sendToTokens` was never actually invoked for any real user. `GAP-REPORT.md`'s "Not gaps" section incorrectly listed push as confirmed end-to-end working — corrected below.

**Root cause**: missing mobile-side integration only. Not a backend defect.

**Fix**: added `@react-native-firebase/app` + `@react-native-firebase/messaging` (v26, the current modular API — `getMessaging()`/`getToken()`/`requestPermission()`/`onTokenRefresh()`/`onMessage()`/`setBackgroundMessageHandler()` as free functions, not the older namespaced `messaging()` object). Registration happens once per authenticated session, at the exact same lifecycle point `SocketService.connect()` already uses (`AuthContext.tsx`'s `applySession` for login/register, and `refreshSession` for silent restore-on-launch) — requests `POST_NOTIFICATIONS` permission (mandatory at runtime on Android 13+, this app targets SDK 36), fetches the FCM token, and posts it to the existing `POST /device-tokens` endpoint via a new `deviceTokens.api.ts` (no new backend endpoint — reused exactly as already built). Also subscribes to token-refresh (re-registers automatically if FCM rotates the token) and a foreground `onMessage` handler that is a deliberate no-op — foreground notification UX is untouched, still entirely driven by the existing `notification:new` Socket.IO event, so a background/killed-state push never also duplicates as an in-app popup while the app is open. Everything is best-effort and swallows its own errors, matching the backend's own contract (`CLAUDE.md §16`) and every other background call in this app (e.g. `DriverLocationTrackingRunner`) — a push failure can never block login.

**Android wiring**: Google Services Gradle plugin added, but only applied when `android/app/google-services.json` actually exists (`if (file("google-services.json").exists()) { apply plugin: ... }`) — the file is project-specific and gitignored (not fabricated), so this keeps the build green exactly as before if it's ever missing, instead of hard-failing. `POST_NOTIFICATIONS` permission added to `AndroidManifest.xml`. A real `google-services.json` (Android app registered under `com.admillmobile` in the same Firebase project as the backend's `FCM_PROJECT_ID`) was obtained and installed — confirmed via `gradlew assembleDebug`/`assembleRelease` that `:app:processDebugGoogleServices`/`:app:processReleaseGoogleServices` correctly parsed it and generated matching `google_app_id`/`project_id`/`gcm_defaultSenderId` resources.

**iOS deliberately not touched**: no `GoogleService-Info.plist` was provided (same blocker as Android, but for a platform this project has never built or tested even once — every APK/demo this whole project has ever done is Android-only, and this is a Windows dev machine with no Xcode/CocoaPods available to build or verify iOS at all). Adding an iOS `FirebaseApp.configure()` call without a real plist would produce dead code that could crash a future iOS build, which is worse than leaving it alone. Revisit if/when iOS is actually needed.

**Files created**: `src/api/deviceTokens.api.ts`, `src/notifications/pushRegistration.ts`, `__mocks__/@react-native-firebase/messaging.js` (manual Jest mock, following the existing convention already used for `react-native-maps`/`react-native-keychain`/etc. — v26's modular API has no native module available in the test environment).

**Files modified**: `package.json`/`package-lock.json` (2 new deps), `android/build.gradle` (Google Services classpath), `android/app/build.gradle` (conditional plugin application), `android/app/src/main/AndroidManifest.xml` (`POST_NOTIFICATIONS` permission), `index.js` (top-level `setBackgroundMessageHandler`), `src/auth/AuthContext.tsx` (registers/unregisters push alongside the existing socket connect/disconnect lifecycle), `.gitignore` (google-services.json/GoogleService-Info.plist).

**APIs used**: `POST /device-tokens` — already existed, unchanged, no new backend endpoint or field invented.

**Verification — source/build verified**: `tsc --noEmit` clean (mobile + backend) · `eslint` clean (mobile + backend) · mobile `jest`: 46 suites / 162 tests, all passing, no regressions · backend `vitest`: 20 files / 104 tests, all passing (unchanged — no backend files were touched) · `gradlew assembleDebug`: **BUILD SUCCESSFUL** · `gradlew assembleRelease`: **BUILD SUCCESSFUL**, `app-release.apk` produced · Google Services plugin confirmed to have actually parsed the real `google-services.json` (not just present-but-inert) via the generated `values.xml` resource file matching the source config.

**Verification — NOT physically verified** (no physical device or emulator available in this dev environment, same limitation as every prior on-device milestone in this file): actual FCM token retrieval on a real device, actual device-token registration reaching the backend, actual push delivery to a backgrounded/killed app, and notification-tap behavior. These require installing the rebuilt APK on a real phone. Do not present this as "push notifications work" until that physical pass has been done.

**Known limitation carried over, not fixed here (explicitly out of scope)**: the backend's FCM send (`firebase.provider.ts`) only sends `{title, body}`, no `data` payload — so even once delivered, a background/killed-state push has no notification ID or job ID attached, meaning tapping it can open the app but can't deep-link to a specific screen. Not touched, since fixing it means changing backend behavior, which wasn't part of this issue's scope.

**Not touched**: any Owner/Driver/Customer business behavior, any existing screen, the Socket.IO notification path (still the only thing driving foreground UI), issues #2–#7.

### QA audit finding #2 fixed — useProfileStatus.ts no longer conflates network/API errors with "no profile" (2026-08-12)

**Root cause**: `getMyCompany`/`getMyDriverProfile`/`getMyCustomerProfile` (`companies.api.ts`/`drivers.api.ts`/`customers.api.ts`) all share one contract: a genuine 404 ("this role truly never completed profile setup") resolves to `null` — a *successful* query with no data — while every other failure (offline, timeout, 5xx) is rethrown and surfaces as the query's `isError`. `useProfileStatus.ts` only ever checked `query.data` truthiness to decide `'ready'` vs `'no-profile'`, never `query.isError` — so a transient network/server failure (data stays `undefined`, exactly like a real 404) was indistinguishable from "never registered", and an already-set-up Owner/Driver/Customer would get routed straight back to the registration/onboarding screen (`CompanySetupScreen`/`DriverRegistrationScreen`/`CustomerRegistrationScreen`) on nothing more than a dropped connection — the exact scenario that already happened once this session when the ngrok tunnel went down.

**Behavior before**: `loading` → loading state (correct) · confirmed no-profile (404) → registration (correct) · confirmed profile exists → ready (correct) · **network failure → registration (bug)** · **backend 500 → registration (bug)**.

**Behavior after**: `loading` → loading state (unchanged) · confirmed no-profile (404) → registration (unchanged) · confirmed profile exists → ready (unchanged) · **network failure → new `error` state with retry, never registration** · **backend 5xx → new `error` state with retry, never registration**. Driver's existing `pending-approval`/`rejected` branches are unchanged (only reachable once the query has genuinely succeeded with data).

**Fix**: added a `{ kind: 'error'; retry: () => void }` member to the `ProfileStatus` union. Each of the three role branches in `useProfileStatus.ts` now checks `query.isError` immediately after `query.isLoading` and before touching `query.data`, returning `{ kind: 'error', retry: () => query.refetch() }`. `OwnerNavigator.tsx`/`DriverNavigator.tsx`/`CustomerNavigator.tsx` each gained one new branch rendering the existing shared `ProfileIncompleteScreen` component (already used for `pending-approval`/`rejected` in `DriverNavigator` — no new UI component introduced) with a "Connection problem" message, a "Retry" action wired to the new `retry()`, and the component's existing built-in "Log out" escape hatch. No backend endpoint or field was touched or invented — this is purely how the mobile app interprets responses it already receives.

**Files created**: `__tests__/hooks/useProfileStatus.test.tsx`.

**Files modified**: `src/hooks/useProfileStatus.ts`, `src/navigation/OwnerNavigator.tsx`, `src/navigation/DriverNavigator.tsx`, `src/navigation/CustomerNavigator.tsx`, `__tests__/customer/navigation/CustomerNavigator.test.tsx` (added one test for the new `error` branch).

**Files deleted**: none.

**Tests added**: 17 new cases in `useProfileStatus.test.tsx` covering, per role where applicable: loading, confirmed 404 → no-profile, confirmed data → ready, network failure (`.networkError()`) → error (never no-profile), backend 500 → error, recovery to ready after `retry()` succeeds (Owner), Driver's `pending-approval`/`rejected`/`approved` branches (confirmed still correct, unaffected by the fix), and 3 query-isolation tests confirming each role's session only ever calls its own `/…/me` endpoint and never another role's. Plus 1 new test in `CustomerNavigator.test.tsx` confirming the `error` kind renders the retry UI (not the registration form) and that pressing Retry calls the hook's `retry()`.

**Existing tests encoding the old (incorrect) behavior**: none found. `CustomerNavigator.test.tsx` and `RootNavigator.test.tsx` both mock `useProfileStatus` wholesale rather than exercising its internal logic, so neither test file ever encoded the bug — no corrections were needed there beyond the one new test added.

**Verification**: `tsc --noEmit` clean · `eslint .` clean · `jest`: **47 suites / 180 tests, all passing** (up from 46/162 after issue #1 — +1 suite, +18 tests; zero regressions). Pre-existing `act()` warnings in `useIncomingJobOffer.test.tsx` and `CustomerProfileScreen`'s query-driven re-render are unrelated to this change (present before it, not touched — out of scope per issue #4/general QA findings, not #2). Android build not re-run: this change touches no native/Gradle/manifest files, JS/TS logic only.

**New backend gaps discovered**: none. The backend's existing `null`-on-404 / rethrow-on-everything-else contract in `getMyCompany`/`getMyDriverProfile`/`getMyCustomerProfile` was already exactly right — the bug was entirely in how the mobile hook consumed it.

**Limitations**: none identified — this is a client-side interpretation fix with no external dependency, no partial state, and no physical-device-only behavior involved.

**Not touched**: any Owner/Driver/Customer business functionality beyond this shared profile-status branch, `ProfileIncompleteScreen`'s own implementation (reused as-is), issues #1 (already done), #3–#7.

### QA audit finding #3 fixed — Driver Vehicle 403 now distinguished from "no vehicle" and unified between Vehicle screen and Dashboard (2026-08-12)

**Investigation, before any code changed**: traced the full flow — `useMyAssignedVehicle.ts` (driver.-side, no backend "my vehicle" endpoint exists — gap #12) derives a vehicleId from the driver's own most recent job (`GET /jobs`, self-scoped) and fetches it via `GET /vehicles/:id`. Confirmed directly against `vehicle.service.ts`'s `getById`/`assertVehicleAccess`: the backend is **already correct** — `getById` throws a real 404 first if the vehicle document genuinely doesn't exist, then only afterward checks access, throwing 403 specifically when the requester is a DRIVER whose `_id` no longer matches the vehicle's current `assignedDriver` (or an OWNER who doesn't own its company). This is clean, textbook-correct separation of "doesn't exist" vs. "not yours" — **backend authorization was not touched**, since it was proven correct rather than assumed. Also confirmed (`vehicle.routes.ts`/`vehicle.controller.ts`) there is no vehicle-delete endpoint anywhere in the backend, so a genuine 404 on a vehicleId sourced from the driver's own real job history is currently unreachable in practice — handled anyway rather than assumed impossible, since a future backend change or direct DB edit (this project's own dev/test data has been hand-edited before) could produce it. Root defect was entirely in `useMyAssignedVehicle.ts`: both `DriverVehicleScreen.tsx` and `DriverDashboardScreen.tsx` collapsed every non-2xx response from `GET /vehicles/:id` into one flat `isError` boolean, discarding the actual HTTP status — so a 403 (vehicle reassigned — expected, legitimate) was indistinguishable from a 500/network failure (retryable) or, on the Dashboard specifically (which never checked `isError` at all), indistinguishable from "no vehicle" (silently wrong).

**Behavior before**: Vehicle screen showed a scary generic "Something went wrong" `ErrorState` for a 403. Dashboard silently showed "No vehicle information available yet." for the identical 403 — same root cause, two different, both misleading, presentations.

**Behavior after**: both screens now share one precise 5-state model — `loading` / `no-vehicle` (no job history yet, worded distinctly from a genuine vehicle-not-found 404) / `unauthorized` (a real 403 — "Not assigned to you", never called an error) / `error` (real network/server failure, retryable) / `ready` (the actual vehicle). Vehicle screen renders the existing `EmptyState`/`ErrorState` components per state (no new UI component introduced); Dashboard renders the matching plain-text/inline-retry equivalent inside its existing card layout — same semantics, same wording where it's user-facing, consistent between both screens for the first time.

**Fix**: `useMyAssignedVehicle.ts` rewritten to return a discriminated union (`{kind:'loading'} | {kind:'no-vehicle', reason:'no-job-history'|'vehicle-not-found'} | {kind:'unauthorized'} | {kind:'error', retry} | {kind:'ready', vehicle}`) — the same pattern established for `useProfileStatus` in issue #2, for consistency. Reuses the existing `isForbiddenError`/`isNotFoundError` helpers from `api/client.ts` (already used elsewhere in the app) rather than inventing new error-classification logic. `DriverVehicleScreen.tsx` and `DriverDashboardScreen.tsx` both updated to branch on `status.kind` instead of the old flat `{vehicle, isLoading, isError, hasNoJobHistory}` shape.

**Files created**: `__tests__/driver/vehicle/useMyAssignedVehicle.test.tsx`.

**Files modified**: `src/features/driver/vehicle/useMyAssignedVehicle.ts`, `src/features/driver/vehicle/DriverVehicleScreen.tsx`, `src/features/driver/dashboard/DriverDashboardScreen.tsx`, `__tests__/driver/vehicle/DriverVehicleScreen.test.tsx` (4 new tests added), `__tests__/driver/dashboard/DriverDashboardScreen.test.tsx` (1 new test added).

**Files deleted**: none.

**Tests added**: 7 new hook-level tests (no-job-history, ready, genuine 404, real 403 → unauthorized, network failure on job lookup → error, backend 500 on vehicle lookup → error, retry-recovers-to-ready) + 4 new Vehicle-screen tests (404 → "No vehicle found" worded distinctly from no-job-history, 403 → "Not assigned to you" and explicitly NOT "No vehicle found"/"Something went wrong", 500 → retryable error and explicitly NOT the other two states, retry recovers to the real vehicle) + 1 new Dashboard test (403 → "This vehicle is no longer assigned to you.", explicitly NOT "No vehicle information available yet.").

**Existing tests encoding the old (incorrect) behavior**: none found — neither existing test file mocked `useMyAssignedVehicle` directly (both exercise it through real `MockAdapter` HTTP responses), and none of the existing test cases happened to hit the 403 path, so nothing asserted the old wrong behavior. All 3 pre-existing tests in `DriverVehicleScreen.test.tsx` and all 3 in `DriverDashboardScreen.test.tsx` still pass unmodified against the new hook shape, since the underlying HTTP contract they mock is unchanged.

**Data vs. UI distinction**: the original real-device 403 this whole investigation started from (`test-driver@admill.dev` seeing "something went wrong" on Vehicle) was caused by test data — the Owner app's own "Reassign Driver" flow was used during earlier manual testing, which correctly and legitimately moved that vehicle's `assignedDriver` to a different driver. That is not an application bug; it's the backend authorization working as designed. The actual bug fixed here is purely how the mobile UI represented that legitimate state. That specific vehicle is still not reassigned back to `test-driver@admill.dev` — not touched, since doing so wasn't part of this issue's scope and doing it silently would count as fabricating/reassigning data just to make a symptom disappear, which was explicitly disallowed.

**Verification**: `tsc --noEmit` clean · `eslint .` clean · `jest`: **48 suites / 192 tests, all passing** (up from 47/180 after issue #2 — +1 suite, +12 tests; zero regressions, confirming Owner vehicle CRUD screens (`VehicleDetailScreen`, `VehiclesTabContent`, `FleetListScreen`) and Owner/Customer navigation/role-isolation are all unaffected — none of those files or their tests were touched). Android build not re-run: no native/Gradle/manifest files changed, JS/TS + UI logic only.

**New backend gaps discovered**: none. `vehicle.service.ts`'s 404-then-403 authorization ordering was confirmed correct and left untouched.

**Limitations**: the underlying gap #12 (no direct backend "my vehicle" endpoint, so this is still a job-history-derived best-effort lookup) is unchanged and out of scope — this issue fixed how the mobile app *interprets and presents* the existing lookup's outcomes, not the lookup mechanism itself.

**Not touched**: backend authorization/routes, Owner or Customer functionality, Owner-side vehicle CRUD (`VehicleDetailScreen.tsx`, `VehicleFormScreen.tsx`, `VehiclesTabContent.tsx` — all Owner-only, none use this hook), any navigator/role-routing wiring, issues #1–#2 (already done), #4–#7.

### QA audit finding #4 fixed — useIncomingJobOffer.ts launch-time race no longer silently drops early offers (2026-08-12)

**Investigation, before any code changed**: traced the complete flow — Socket.IO connection → `job:new-request` (broadcast unfiltered to the whole company fleet room) → driver-ID resolution → `useIncomingJobOffer`'s own filter → offer state → `IncomingJobOfferModal`. Confirmed `SocketService.connect()` fires in `AuthContext.tsx` the moment auth succeeds — independent of, and often earlier than, `DriverNavigator.tsx`'s `useProfileStatus()`-gated render tree, which used to be the *only* place `DriverOfferOverlay` (and therefore this hook's socket listener) ever mounted. That meant a real `job:new-request` could reach the client's socket while zero listener existed to catch it at all — an event genuinely delivered but structurally unreachable, not a bug in the hook itself. A narrower, second window existed even after the listener registers: the hook's own driver-ID lookup is asynchronous, so an offer could arrive after the listener existed but before `myDriverIdRef` was populated — this second window is the one a client-side fix can *honestly* recover, since the event did reach a live listener.
Also checked, per the explicit instruction to distinguish "reached too early" from "never delivered": confirmed via `admill-backend/src/config/socket.ts` that no `connectionStateRecovery` option is configured on the Socket.IO server, so the transport itself never replays anything sent while a socket was disconnected — nothing here pretends to recover a truly-undelivered event, only ones that arrived while genuinely connected.
Separately discovered (not fixed, out of scope for this issue, see "new backend gaps" below): `admill-backend/src/socket/index.ts`'s `registerSocketHandlers` calls `joinCompanyFleetRoom(socket)` as a fire-and-forget `void` async call inside the `connection` handler — a real server-side window exists where a socket has finished connecting but hasn't yet joined its `company:X:fleet` room when a `job:new-request` is broadcast, meaning that specific socket would never receive it regardless of anything the client does.

**Root cause**: two compounding gaps, both on the mobile side. (1) `DriverOfferOverlay` — the only place `useIncomingJobOffer`'s socket listener registers — was gated behind `profileStatus.kind === 'ready'` in `DriverNavigator.tsx`, so the listener didn't exist for the entire span of the driver-profile fetch after login/launch. (2) Within the hook itself, `handleNewRequest` checked `myDriverIdRef.current` and silently `return`ed (dropping the event with no trace) whenever it was still `null`, instead of holding onto the event for a later re-check.

**Fix**:
1. `DriverNavigator.tsx` restructured so `<DriverOfferOverlay />` renders unconditionally, outside every `profileStatus.kind` branch, instead of only inside the `'ready'` branch — the listener now registers as early as this navigator itself mounts (essentially the same moment `SocketService.connect()` fires), closing almost the entire real race window structurally rather than papering over it.
2. `useIncomingJobOffer.ts` rewritten: the driver-ID lookup is now a real `useQuery(['drivers','me'], getMyDriverProfile)` — the exact same cache entry `useProfileStatus`'s own driver query already uses — instead of a one-off imperative fetch in a `useEffect`, so a fetch already in flight when this hook mounts is picked up reactively the moment it resolves, not just checked once at mount. `considerOffer` (the renamed filter/handler) now buffers an event in a capped (`slice(-5)`) ref-backed array when the ID isn't known yet instead of dropping it; a `useEffect` watching `driverQuery.data` drains and re-evaluates that buffer the moment the ID resolves. A `seenJobIdsRef` `Set` permanently dedupes by job `_id` for the lifetime of the hook instance, so a duplicate/retried `job:new-request` for a job already surfaced (accepted, rejected, or dismissed) can never reopen the modal — naturally reset on logout since the hook unmounts along with `DriverNavigator` when `RootNavigator` swaps back to `AuthNavigator`.

**Files created**: `__tests__/navigation/DriverNavigator.test.tsx`.

**Files modified**: `src/features/driver/offers/useIncomingJobOffer.ts`, `src/navigation/DriverNavigator.tsx`, `__tests__/driver/offers/useIncomingJobOffer.test.tsx` (4 new tests + 3 existing ones kept, rewritten test-infrastructure — see below), `__tests__/navigation/DriverNavigator.test.tsx` (fixed a missing `useAuth` mock needed for `ProfileIncompleteScreen`'s "Log out" button, discovered while adding this file).

**Files deleted**: none.

**Tests added**: 4 new hook-level cases covering the exact scenarios required — offer arriving before the driver ID resolves (buffered, then surfaced once the query resolves, not lost), a buffered offer that was never actually for this driver (stays suppressed once the ID resolves, not shown), a duplicate `job:new-request` for an already-shown-and-dismissed job (not reopened), and a fresh mount after unmount (clean state — no leaked buffer/dedup, and a genuinely re-broadcast job in the new session is still correctly shown, proving dedup is per-session not global). Plus 3 new `DriverNavigator.test.tsx` tests proving the overlay mounts (and can show a real offer) even while `profileStatus` is `'loading'` or `'pending-approval'`, and that the normal `'ready'` tab shell is unaffected.

**A real test-infrastructure bug found and fixed along the way, not a source bug**: the new hook-level tests were flaky/failing for reasons that traced back to two separate testing-library/React-Query interactions, not the hook's logic (confirmed correct throughout via direct instrumentation before either fix): (1) TanStack Query defers cache-notification delivery through an internal `scheduleFn` (a real `setTimeout(fn, 0)`, since React Native has no `unstable_batchedUpdates` to batch through instead) — fixed in the test file via `notifyManager.setScheduler`/`setBatchNotifyFunction`, the documented approach for testing React Query outside ReactDOM. (2) `@testing-library/react-native`'s own `act()` (`dist/act.js`) always wraps its callback in an async function internally, even for a synchronous callback — every `act(() => {...})` call in this file that wasn't `await`ed was therefore silently asynchronous, and left React's global act-environment flag in a corrupted state for whatever test ran next (surfaced as "overlapping act() calls" / "testing environment is not configured to support act(...)" warnings, and cascading failures in later tests that had nothing to do with their own logic). Every `act()` call in this file is now `await`ed.

**Existing tests encoding the old (incorrect) behavior**: none found — none of the 3 pre-existing tests exercised the "ID not yet known" window at all (all pre-seed `['drivers','me']` synchronously before render), so nothing asserted the old silent-drop behavior. All 3 still pass unmodified in substance (only the shared test-file setup around them changed).

**Verification**: `tsc --noEmit` clean · `eslint .` clean · full mobile `jest`: **49 suites / 199 tests, all passing** (up from 48/192 after issue #3 — +1 suite, +7 tests; zero regressions) — including this file's own 7/7 and the new `DriverNavigator.test.tsx`'s 3/3. No dangling-handle ("Jest did not exit") warning anywhere in the full run, confirming the test-infrastructure fixes above didn't just mask the symptom. Android build not re-run: no native/Gradle/manifest files changed, JS/TS + navigation logic only.

**New backend gaps discovered**: `admill-backend/src/socket/index.ts`'s fire-and-forget `joinCompanyFleetRoom(socket)` call (see investigation notes above) — a genuine server-side timing window where a freshly-connected socket hasn't yet joined its company fleet room when a `job:new-request` is broadcast, meaning that specific delivery is lost server-side, not recoverable by any client-side fix. **Not fixed here** — this issue was explicitly scoped to the mobile-side race in `useIncomingJobOffer.ts`; fixing backend connection-handling ordering is a distinct change requiring its own authorization.

**Limitations**: the backend's `job:new-request` payload still carries no server-side delivery guarantee/replay (no `connectionStateRecovery` configured) — an offer broadcast while this driver's socket is genuinely disconnected (not just "connected but ID unknown") is lost exactly as before, and correctly so; no client-side buffering can honestly recover an event that was never transmitted. This fix only closes the "reached the socket, no listener yet / ID not yet known" window, per the explicit scope of this issue.

**Not touched**: backend socket/connection handling (including the newly-discovered fleet-room-join gap above), Owner or Customer functionality, `DriverLocationTrackingRunner`'s own mount timing (deliberately left gated to `'ready'` — a separate GPS-reporting concern, not part of this race), `IncomingJobOfferModal.tsx`'s own accept/reject logic, issues #1–#3 (already resolved), #5–#7.

### QA audit finding #5 fixed — Owner and Driver dashboard pull-to-refresh spinners now reflect the real refetch state (2026-08-12)

**Root cause**: both `DashboardScreen.tsx` (Owner) and `DriverDashboardScreen.tsx` hardcoded `<RefreshControl refreshing={false} onRefresh={refetchAll} />`. `onRefresh`/`refetchAll` genuinely worked (data did refresh), but the spinner itself was wired to a literal `false`, never to any real loading state — so the pull-to-refresh gesture always looked like it did nothing. For Owner, the underlying `useDashboardData.ts` hook never exposed any `isFetching`/`isRefetching` value at all — only `isLoading`/`isError` — so the screen had no real state to bind to even if it had tried.

**Fix**: `useDashboardData.ts` now aggregates `isFetching` across all of its underlying queries (`fleetQuery`, `revenueQuery`, `pendingQuery`, `recentJobsQuery`, the 4 `activeQueries`) and derives `isRefetching = isFetching && !isLoading` — deliberately excluding the initial load (already covered by the full-screen `LoadingState`) so this is specifically a *refetch* indicator, matching what `RefreshControl.refreshing` is actually meant to represent. `DashboardScreen.tsx` now reads `refreshing={isRefetching}`. `DriverDashboardScreen.tsx` didn't need a hook change — its own `driverQuery` (a plain `useQuery` already declared directly in the component) is the same query that already gates `isLoading` for the whole screen, so `refreshing={driverQuery.isFetching && !driverQuery.isLoading}` reuses that exact query's own state, no new hook plumbing needed. Neither screen's actual refresh *behavior* (what gets refetched) was touched — only what the spinner is bound to.

**Files created**: none.

**Files modified**: `src/features/owner/dashboard/useDashboardData.ts`, `src/features/owner/dashboard/DashboardScreen.tsx`, `src/features/driver/dashboard/DriverDashboardScreen.tsx`, `__tests__/owner/useDashboardData.test.tsx`, `__tests__/owner/DashboardScreen.test.tsx`, `__tests__/driver/dashboard/DriverDashboardScreen.test.tsx`.

**Files deleted**: none.

**A real test-environment limitation discovered along the way, not a source bug**: this project's test renderer (a custom `test-renderer` package, not classic `react-test-renderer`) has no `UNSAFE_getByType`-style query, and its `TestInstance` model only represents host (native) elements, not composite components — so `RefreshControl` itself never appears as a matchable node in the tree, only whatever host component it renders underneath (`RCTRefreshControl` on the iOS code path, which the Jest environment defaults to regardless of the app's real Android target). That host node's Jest-preset mock doesn't forward `refreshing`/`onRefresh` as inspectable props — only `children` survives. This means the exact `refreshing` prop *value* cannot be reliably asserted through the rendered tree in this environment; it is not evidence the fix is wrong, since `DashboardScreen.tsx`/`DriverDashboardScreen.tsx`'s JSX is TypeScript-checked to pass a real `boolean` (`isRefetching` / `driverQuery.isFetching && !driverQuery.isLoading`), not the literal `false` anymore. Tests instead verify what the environment *can* reliably observe: the underlying boolean's own correctness at the hook level, and that `onRefresh` still triggers a real refetch end-to-end.

**Tests added/changed**: `useDashboardData.test.tsx` — 1 new test proving `isRefetching` is `false` during the initial load, then `true` only while a genuine second fetch (triggered by `refetchAll()`) is in flight, `false` again once it resolves, with the refreshed data actually reflected. `DashboardScreen.test.tsx` — replaced an unreliable prop-inspection attempt with a test proving `onRefresh` still calls the real `refetchAll` (refresh behavior itself unchanged), verified via `container.queryAll(...)` + `fireEvent`. `DriverDashboardScreen.test.tsx` — same pattern, but end-to-end through real `MockAdapter` responses: fires `refresh`, then asserts the screen actually re-renders with genuinely new data from a second `/drivers/me` response (not just that a mock function was called), proving the refetch is real.

**Existing tests encoding the old (incorrect) behavior**: none found — no prior test in either file asserted anything about the `refreshing` prop's value (the bug had no test coverage at all before this).

**Verification**: `tsc --noEmit` clean · `eslint .` clean · full mobile `jest`: **49 suites / 202 tests, all passing** (up from 49/199 after issue #4 — +3 tests, zero regressions, no dangling-handle warnings). Android build not re-run: no native/Gradle/manifest files changed, JS/TS + UI logic only.

**New backend gaps discovered**: none — this issue was entirely a mobile-side state-binding problem.

**Limitations**: none identified.

**Not touched**: backend, Owner or Customer functionality beyond these two dashboards, what `refetchAll` actually refetches on either screen, issues #1–#4 (already resolved), #6–#7.

### QA audit finding #6 fixed — MoreScreen.tsx's deprecated SafeAreaView import replaced (2026-08-12)

**Root cause**: `MoreScreen.tsx` imported `SafeAreaView` from `'react-native'` — the deprecated, iOS-only version (a no-op on Android) — instead of `'react-native-safe-area-context'`, which every other screen in the codebase correctly uses. Re-confirmed via a full-tree grep that this was genuinely the only occurrence before fixing it, and confirmed zero remaining occurrences after.

**Fix**: swapped the import to `react-native-safe-area-context`'s `SafeAreaView` and added `edges={['top']}`, matching the exact, established convention used by every comparable top-level tab screen (`DashboardScreen.tsx`, `JobsListScreen.tsx`, `DriverProfileScreen.tsx`, etc. — confirmed by inspecting several before changing anything). No new SafeArea implementation introduced; purely adopted the existing one.

**Files created**: `__tests__/owner/more/MoreScreen.test.tsx` (no test existed for this screen before).

**Files modified**: `src/features/owner/more/MoreScreen.tsx`.

**Files deleted**: none.

**Tests added**: 3 — renders the real signed-in owner's name and all 4 menu items; each menu item navigates to its correct destination screen; "Log out" calls the real `logout()`.

**Verification**: `tsc --noEmit` clean · `eslint .` clean · full mobile `jest`: **50 suites / 205 tests, all passing** (up from 50/202 after issue #5 — +1 suite, +3 tests, zero regressions). Android build not re-run: no native/Gradle/manifest files changed, a single import + one JSX prop.

**New backend gaps discovered**: none.

**Limitations**: none identified.

**Not touched**: backend, Owner or Customer functionality beyond this one screen, any other SafeAreaView usage (all already correct), issues #1–#5 (already resolved), #7.

### QA audit finding #7 fixed — Analytics screen now displays the per-vehicle date-range utilization data it was already fetching (2026-08-12)

**Investigation, before any code changed**: re-traced the exact existing API response before touching anything. Confirmed via `src/api/analytics.api.ts` and `src/types/entities.ts`'s `FleetUtilization` type that `getFleetUtilization(range)` already returns `vehicles: Array<{vehicleId, vehicleCode, completedJobsCount}>`, and re-confirmed directly against `admill-backend/src/modules/analytics/analytics.service.ts` that `completedJobsCount` there is genuinely scoped to the selected date range (`JobRepository.getCompletedJobStatsByVehicle(companyId, range.startDate, range.endDate)`) — unlike `statusBreakdown`, which is always current-state regardless of range. `AnalyticsScreen.tsx` already called this exact endpoint (`fleetQuery`) and already used `totalVehicles`/`statusBreakdown` from its response, but never rendered the `vehicles` array at all — no second request needed, the data was already sitting unused in a query the screen already had.

**Fix**: added a "Vehicle Utilization" section, sorted by `completedJobsCount` descending (mirroring the existing "Driver Performance" section's own sort-by-revenue-descending pattern directly above it), using only existing design-system components (`Card`, `Text` — the same building blocks `DriverStatRow` right below it already uses) via a new `VehicleUtilizationRow` component modeled directly on `DriverStatRow`. An honest "No vehicle activity in this range." empty state matches the existing "No driver activity in this range." wording exactly. No backend field, endpoint, or metric was invented — every value displayed already existed in the response this screen was already fetching.

**Files created**: none.

**Files modified**: `src/features/owner/analytics/AnalyticsScreen.tsx`, `__tests__/owner/analytics/AnalyticsScreen.test.tsx`.

**Files deleted**: none.

**Tests added**: 2 — per-vehicle utilization renders with the correct completed-jobs count and is sorted descending (verified via tree-position ordering, not just presence); an honest empty state (not a fabricated placeholder) when no vehicle has activity in the selected range. Both existing tests (which already passed `vehicles: []`) continue to pass unmodified, now correctly exercising the new empty-state path instead of silently rendering nothing.

**Existing tests encoding the old (incomplete) behavior**: none found — no prior test asserted that the vehicles array was absent from the UI; the gap simply had no coverage either way before this.

**Verification**: `tsc --noEmit` clean · `eslint .` clean · full mobile `jest`: **50 suites / 207 tests, all passing** (up from 50/205 after issue #6 — +2 tests, zero regressions). A standalone single-file run of just this test showed a "Jest did not exit" warning; re-confirmed absent when run as part of the full suite, consistent with this being a known artifact of MockAdapter teardown timing in isolated single-file runs elsewhere in this project, not a real regression introduced here. Android build not re-run: no native/Gradle/manifest files changed, UI + display logic only.

**New backend gaps discovered**: none — the data already existed and was already correct; this was purely an unused-response-field gap on the mobile side.

**Limitations**: none identified.

**Not touched**: backend, Owner or Customer functionality, the existing "Fleet Utilization" (current-state status breakdown) section directly above the new one, `getFleetUtilization`'s own implementation, issues #1–#6 (already resolved).

---

## QA Audit — all 7 findings resolved (2026-08-12)

All 7 issues from the QA/bug-hunting audit have now been fixed, one at a time, each independently verified (`tsc`, `eslint`, full `jest` suite) before moving to the next:

1. Push notifications wired end-to-end at the source/build level (physical-device delivery still unverified — no device/emulator in this dev environment).
2. `useProfileStatus.ts` no longer conflates network/API errors with "no profile."
3. Driver Vehicle 403 distinguished from "no vehicle," consistent between the Vehicle screen and Dashboard.
4. `useIncomingJobOffer.ts` launch-time race fixed — offers arriving before the driver ID resolves are buffered, not dropped.
5. Owner and Driver dashboard pull-to-refresh spinners reflect the real refetch state.
6. `MoreScreen.tsx`'s deprecated `SafeAreaView` import replaced.
7. Analytics screen now displays the per-vehicle date-range utilization data it was already fetching.

Two genuine backend gaps were discovered during this work but deliberately **not fixed**, since they were outside each issue's authorized scope — both documented above and in `GAP-REPORT.md` for future, separately-authorized work:
- `socket/index.ts`'s fire-and-forget `joinCompanyFleetRoom` call (a real server-side timing window, found during issue #4's investigation).
- The backend's FCM push send carries no `data` payload, so a delivered push can't deep-link to a specific screen (found during issue #1).

Full backend test suite (20 files / 104 tests) was re-verified as unaffected after issue #1, the only phase touching anything backend-adjacent (it didn't — Firebase/push wiring was mobile-only); it was not re-run for issues #2–#7 since none of them touched any backend file.
