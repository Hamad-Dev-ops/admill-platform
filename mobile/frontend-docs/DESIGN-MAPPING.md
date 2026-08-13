# Design → Backend Capability Mapping

**Source note on fidelity**: `TezRecovery_Light__standalone_.html` is a compiled/bundled runtime artifact (React + assets inlined as a base64 manifest executed at load time) — it has no readable source text (confirmed: grepping the file for screen/component names returns nothing outside the bundler's own loader script). It cannot be opened by a file-reading tool the way a normal source file can; it only renders in an actual browser. This mapping is therefore built from the screen-by-screen descriptions and the 10 screenshots already reviewed earlier in this project (Splash/Onboarding, the interactive Customer flow, Driver app, Owner app, and the design's own "Architecture/Handoff" notes) rather than a fresh re-read of the file. **Before Phase 2 (Design System)** — where exact color/spacing/type tokens matter pixel-for-pixel — re-open the HTML in a browser (or the original design tool export, if one exists) and confirm token values directly; treat the values below as "known, previously confirmed" but re-verify before locking the theme file.

**Confirmed design tokens** (from the bundle's own visible loader markup + prior review): primary brand color Amber `#F5A623`, canvas/background `#F4F2EE` (bundler chrome uses a close neighbor `#EFECE7`), ink/text `#14161A`. Full type scale, spacing grid, and component-level tokens (buttons, cards, sheets) need re-confirmation in-browser before Phase 2.

**Handoff notes captured from the design's own "Architecture/Handoff" section**: layout grid, glass/blur specs, typography, motion, and an explicit **real-time GPS cadence spec — 4s while the driver is on an active job, 15s while idle** — this cadence is client-side-only (see `SOCKET-CONTRACT.md`), plus accessibility notes and two authored addenda sections ("Six things I'd add to the brief," "Micro-interactions") whose exact bullet text should be re-confirmed from the live-rendered page before Phase 2/9, since it wasn't extractable as plain text from the bundle file.

---

## Auth / Onboarding

| Design screen | Backend support |
|---|---|
| Splash | client-only (no API) |
| Onboarding carousel | client-only |
| Role select | client-only — feeds `role` into `POST /auth/register` |
| Login | ✅ `POST /auth/login` (email + password) |
| **OTP screen** | ❌ **GAP** — backend has no phone/OTP verification endpoint anywhere (auth is email+password only, no SMS provider integrated). See GAP-REPORT.md. |
| Driver registration / documents | ✅ `POST /drivers` (profile) + `POST /drivers/:id/documents` (per-document upload), but this is a two-step server model: register profile first (get `driverId` back), then upload documents against that id — design a multi-step form, not a single combined submit. |

## Customer flow

| Design screen | Backend support |
|---|---|
| Home | client shell; likely surfaces `GET /services` for the service picker |
| Service selection | ✅ `GET /services` |
| Fare estimate | ✅ `POST /pricing/estimate` |
| Matching / "finding a driver" | ⚠️ **partial** — there's no per-driver "matching in progress" concept server-side. Creation (`POST /jobs`) snapshots ALL eligible nearby drivers into `offeredDriverIds` at once and notifies all of them simultaneously; first to `accept` wins. A "matching" screen should be a single indeterminate wait state listening for `job:accepted` (or `job:status-changed`) over the socket, not an animation stepping through individual drivers being asked one at a time. If the design specifically shows sequential single-driver matching, flag as a gap (see GAP-REPORT.md). |
| Live tracking (map, driver position) | ✅ `driver:location:changed` socket event scoped to `job:<jobId>`; `GET /drivers/:id/location` as a fallback snapshot. **No route polyline/turn-by-turn geometry comes from the backend** — `POST /pricing/estimate`/`POST /jobs` return `distanceKm`/`durationMinutes` only, not a route line. Drawing the actual road path on the map requires calling a maps SDK/directions API directly from the client (e.g. the maps provider you choose for `react-native-maps`), not the Admill backend. |
| Complete & Rate | ✅ job reaches `COMPLETED` → `POST /jobs/:id/rating` (`{stars, review?}`) |
| Chat (customer ↔ driver) | ❌ **GAP** — no messaging endpoints or socket events exist anywhere in the backend. See GAP-REPORT.md. |
| History / Receipts | ⚠️ **partial** — `GET /jobs?status=COMPLETED` gives the list; there is **no receipt/invoice/PDF generation endpoint**. A "receipt" screen can only show the job's own fields (`finalFare`, `pickupLocation`, `destinationLocation`, timestamps) — no formatted receipt document exists server-side. |
| Notifications | ✅ `GET /notifications`, `PATCH /notifications/:id/read`, plus live `notification:new` socket event |
| Profile | ✅ `GET/PATCH /customers/me` (fields: `nationalId`, `address` only — no photo/avatar field on Customer beyond what the populated `User.profileImage` provides) |
| **"Vehicles" under customer profile** | ❌ **GAP / model mismatch** — the backend has no concept of a customer-owned vehicle. `Vehicle` belongs to a company's fleet and is driven by drivers, not owned by customers. If the design's customer profile shows "your vehicles," this needs a product decision, not just a frontend build. See GAP-REPORT.md. |

## Driver app

| Design screen | Backend support |
|---|---|
| Dashboard / go online-offline | ✅ `PATCH /drivers/me/status` (`AVAILABLE`/`OFFLINE`/`ON_BREAK` only — see ROLE-PERMISSION-MATRIX.md for what's system-only) |
| Incoming job offer | ✅ `job:new-request` socket event (company fleet room) + `POST /jobs/:id/accept` / `/reject` |
| Active job / navigation | ✅ status progression (`PATCH /jobs/:id/status`) drives the job forward; live position sent via socket `driver:location:update` (4s/15s cadence, client-managed). Turn-by-turn navigation itself (voice guidance, route rendering) is a client/maps-SDK concern, same caveat as customer live tracking above. |
| Earnings | ⚠️ **partial** — no dedicated "my earnings" summary endpoint for drivers (analytics endpoints are OWNER-only). Achievable client-side by fetching `GET /jobs?status=COMPLETED` (already scoped to the driver's own assigned jobs) and summing `finalFare` locally — fine for a simple total, but there's no server-side breakdown by day/week/period the way the design's earnings screen likely implies. Flag if the design needs period-bucketed earnings (see GAP-REPORT.md). |
| Profile / compliance (documents, approval status) | ✅ `GET/PATCH /drivers/:id` (self), `POST/GET /drivers/:id/documents`, `approvalStatus` field for a "pending/approved/rejected" compliance banner |

## Owner app

| Design screen | Backend support |
|---|---|
| Command dashboard | ✅ composed from `GET /jobs` (company-scoped), `GET /analytics/revenue`, `GET /drivers` |
| Live fleet tracking | ✅ `driver:location:changed` broadcast to `company:<id>:fleet` room (auto-joined) |
| Fleet management | ✅ `GET/POST/PATCH /vehicles`, `POST /vehicles/:id/assign-driver` |
| **Job management / manual assignment** | ⚠️ **partial** — owner can view all company jobs (`GET /jobs`) and cancel any of them, but there is **no owner endpoint to manually assign/reassign a job to a specific driver**. Assignment only happens through the offer-broadcast + driver-accept flow. If the design shows an owner picking a specific driver for a job, that's a gap (see GAP-REPORT.md). |
| Reports / analytics | ✅ `GET /analytics/{revenue,drivers,fleet-utilization}` |
| Settings — company/operating hours | ✅ `GET/PATCH /companies/me/settings` |
| Settings — pricing rules | ⚠️ **partial** — `GET/POST /pricing/config` works, but it's global across all companies, not company-scoped (see ROLE-PERMISSION-MATRIX.md). The design can present it as "your pricing rules"; just know it isn't actually isolated per-company server-side yet. |

## Cross-cutting design system notes for Phase 2

- Bottom-tab + stack navigation per role (Owner/Driver/Customer) matches the role model exactly (one role per session, decided at login) — no in-app role switcher needed.
- The design's glass/blur and motion specs are visual polish, not functionally load-bearing — safe to defer/simplify if a given effect isn't cheaply achievable in React Native (e.g. real backdrop blur has platform caveats) without blocking on backend anything.
- Accessibility notes from the handoff section should be re-extracted verbatim from a live render of the bundle before Phase 2, rather than assumed from memory.
