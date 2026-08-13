# Role & Permission Matrix (ground truth)

Three roles, set once at `POST /auth/register` and never changed afterward (no "switch role" endpoint exists). A user is exactly one of `OWNER`, `DRIVER`, `CUSTOMER`. This matters for `admill-mobile`'s navigation design: role is known immediately after login/register and is stable for the session — route to the correct root navigator (Owner/Driver/Customer) right after auth and never re-derive it mid-session.

Enforcement is real backend authorization (`requireRole` middleware + service-layer ownership checks), **not** just UI hiding. Any client-side role/tab gating in the RN app is UX convenience only — the backend is the actual security boundary and will 403 regardless of what the client shows.

## Two-step profile creation (applies to DRIVER and CUSTOMER, not OWNER)

Registering with `role: DRIVER` or `role: CUSTOMER` only creates the `User`. A second, separate call is required before the role's real features work:
- CUSTOMER: `POST /customers` (`nationalId`, `address?`) — without this, `POST /jobs` 404s with `"Customer profile not found"`.
- DRIVER: `POST /drivers` (`companyCode` + ID/license fields) — without this, nothing driver-specific works. Additionally the resulting profile starts `approvalStatus: PENDING_APPROVAL` and cannot go `AVAILABLE` until an OWNER approves it.

OWNER has no separate "profile" step beyond `POST /companies` (creating their company) — but until they do, most owner screens (fleet, jobs, analytics) have nothing to show and several endpoints 404 `"Company not found"`.

**Frontend implication**: post-auth routing per role needs a "profile incomplete" branch, not just "logged in → go to role home":
- CUSTOMER: registered but no `GET /customers/me` → onboarding step to collect nationalId/address.
- DRIVER: registered but `GET /drivers/me` 404s (`"Driver profile not found"`) → registration/company-code flow; if profile exists but `approvalStatus !== APPROVED` → a "pending approval" waiting screen, not the dashboard. **`GET /drivers/me` was added in Phase 3** (previously missing — see GAP-REPORT.md gap #10, now resolved) — use it directly, the local-id-cache workaround from Phase 1 is no longer needed for this lookup.
- OWNER: no `GET /companies/me` (404) → company-creation onboarding flow.

## Per-resource access matrix

| Resource / action | OWNER | DRIVER | CUSTOMER |
|---|---|---|---|
| Company lookup by code | ✅ any | ✅ any | ✅ any |
| Create/read/update own company | ✅ own only | ❌ | ❌ |
| Company settings (hours, radius, prefs) | ✅ own only | ❌ | ❌ |
| Register as driver (`POST /drivers`) | ❌ | ✅ self | ❌ |
| List drivers | ✅ own company | ❌ | ❌ |
| Read/update a driver profile | ✅ own company's drivers | ✅ self only | ❌ |
| Approve/reject driver | ✅ own company | ❌ | ❌ |
| Update own location/status | ❌ | ✅ self | ❌ |
| Read a driver's location | ✅ owns that driver's company | ✅ self | ✅ only if on an active job with that driver |
| Driver ratings list | ✅ own company's drivers | ✅ self | ❌ (only via job rating flow) |
| Vehicles: create/update/assign | ✅ own company | ❌ | ❌ |
| Vehicles: read one | ✅ own company | ✅ if assigned to them | ❌ |
| Documents: upload/list (company/driver/vehicle) | ✅ own company + own company's drivers/vehicles | ✅ own only | ❌ |
| Documents: verify | ✅ own company's docs only | ❌ | ❌ |
| Customer profile create/read/update | ❌ | ❌ | ✅ self only |
| Service catalog: read | ✅ | ✅ | ✅ |
| Service catalog: create | ✅ (global, any owner) | ❌ | ❌ |
| Pricing: estimate | ✅ | ✅ | ✅ |
| Pricing config: read/write | ✅ (global — **any** owner can change pricing for **every** company, known gap, see GAP-REPORT) | ❌ | ❌ |
| Create job | ❌ | ❌ | ✅ (needs Customer profile) |
| List jobs | ✅ own company's jobs | ✅ own assigned jobs | ✅ own jobs |
| Read one job | ✅ if owns company | ✅ if assigned | ✅ if owner of job |
| Accept/reject job offer | ❌ | ✅ only if in that job's `offeredDriverIds` and own company | ❌ |
| Progress job status (EN_ROUTE/ARRIVED/STARTED/COMPLETED) | ❌ | ✅ only the assigned driver | ❌ |
| Cancel job | ✅ if can view it | ✅ if can view it | ✅ if can view it |
| Rate a completed job | ❌ | ❌ | ✅ only the job's own customer |
| Notifications: list/mark-read | ✅ self | ✅ self | ✅ self |
| Register device token (push) | ✅ | ✅ | ✅ |
| Analytics (revenue/drivers/fleet) | ✅ own company only | ❌ | ❌ |
| Read own profile via `/me` shortcut | ✅ `GET /companies/me` | ✅ `GET /drivers/me` (added Phase 3) | ✅ `GET /customers/me` |

## Notable asymmetries worth designing around

- **No admin/platform role exists.** Pricing config and the service catalog are effectively global and owner-writable by anyone with the OWNER role — not scoped per-company. Don't design a "your company's pricing rules are isolated from other companies" screen as if it's already enforced server-side; it visually can be (show only this owner's view), but the underlying data isn't actually siloed yet.
- ~~A driver cannot fetch "my own profile" directly~~ — **resolved in Phase 3**: `GET /drivers/me` now exists, mirroring `GET /companies/me`/`GET /customers/me` exactly.
- **Job cancellation is available to all three roles** (whoever can view the job), unlike status progression which is driver-only. Build one shared "cancel" affordance rather than three different endpoints.
- **`DriverStatus.ON_LEAVE`/`SUSPENDED` have no owner-facing endpoint** — if the design has an owner "suspend this driver" button, it's a gap (see GAP-REPORT.md).
