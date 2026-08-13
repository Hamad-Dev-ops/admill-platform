# API Contract — Admill Backend (ground truth for admill-mobile)

Source: `D:\Admil\admill-backend\src`, verified by direct source read on 2026-08-09. This is the **authoritative** contract — if the design implies a capability not listed here, treat it as a gap (see `GAP-REPORT.md`), not something to invent client-side.

Base URL: `http://<host>:<port>/api/v1` (all routes below are relative to this).

## Cross-cutting mechanics

**Auth header**: `Authorization: Bearer <accessToken>`. Missing/invalid → `401`. `req.user = {id, role}` decoded from JWT (`sub`, `role`), access token expiry default `15m`.

**Refresh tokens**: opaque random hex, **not** JWT, HMAC-SHA256-hashed server-side, default expiry `30d`. Returned both in JSON body (`refreshToken`) and as an httpOnly, `secure`(prod)/`sameSite:strict` cookie named `refreshToken`. A mobile client cannot rely on the cookie (no shared cookie jar with a browser) — **always use the JSON body `refreshToken` and store it securely (Keychain/Keystore)**, send it explicitly on `/auth/refresh` and `/auth/logout`.

**Response envelope**
```json
// success
{ "success": true, "data": <T>, "message"?: "string", "meta"?: { "page": 1, "limit": 20, "total": 57 } }
// error
{ "success": false, "message": "string" }
```
`message`/`meta` are omitted (not null) when not applicable. Validation errors: `400`, message is a **single semicolon-joined string** (`"field: msg; field2: msg2"`), not a field-keyed object — don't build UI that expects structured per-field error objects from the server; parse/split if you want per-field highlighting, or just show the string.

**Pagination**: `?page=` (default 1) `&limit=` (default 20, max 100, clamped). Response `meta: {page, limit, total}`.

**Rate limits** (disabled when `NODE_ENV=test`, active in dev/prod):
- Auth (`register`/`login`/`refresh`): 10 req / 15 min / IP → `429 {success:false, message:"Too many attempts, please try again later"}`
- `POST /jobs`: 30 req / 15 min / IP → `429 {success:false, message:"Too many job requests, please try again later"}`

**CORS**: locked to a single `FRONTEND_URL` origin, not a wildcard. **This is a web-CORS concept and does not affect a React Native app** (RN doesn't send an `Origin` header the way a browser does) — flagged here only so it's not mistaken for a blocker.

**File upload**: multipart field name must be exactly `file`, ≤5MB, `image/jpeg|png|webp` or `application/pdf`. Plus a required `documentType` field (see `DocumentType` enum below).

**GeoJSON**: `{ type: "Point", coordinates: [longitude, latitude] }` — **lng first**, not `[lat,lng]`. Every location field in this API uses this shape.

**Base entity fields** (every resource): `_id`, `isActive`, `isDeleted`, `createdAt`, `updatedAt`.

**No DTO layer**: most endpoints return the Mongoose document close to as-is. Optional unset fields are simply absent from JSON (not `null`).

**Health check**: `GET /health` (no `/api` prefix, no auth) → `{success:true, data:{status:"OK", timestamp}}`.

---

## Enums (exact values)

```ts
UserRole = "OWNER" | "DRIVER" | "CUSTOMER"

DriverStatus = "AVAILABLE" | "ON_JOB" | "OFFLINE" | "ON_BREAK" | "ON_LEAVE" | "SUSPENDED"
DriverApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED"

ServiceType = "CAR_TOWING" | "BOX_RECOVERY" | "BIKE_TOWING" | "JUMP_START"
            | "BATTERY_REPLACEMENT" | "FLAT_TIRE_REPLACEMENT" | "FUEL_DELIVERY"

JobStatus = "PENDING" | "ACCEPTED" | "EN_ROUTE" | "ARRIVED" | "STARTED"
          | "COMPLETED" | "CANCELLED" | "EXPIRED"

DevicePlatform = "IOS" | "ANDROID" | "WEB"

DocumentOwnerType = "DRIVER" | "VEHICLE" | "COMPANY"
DocumentType = "EMIRATES_ID" | "DRIVING_LICENSE" | "PASSPORT" | "PROFILE_PHOTO"
             | "VEHICLE_REGISTRATION" | "INSURANCE_CERTIFICATE" | "ROAD_PERMIT" | "COMPANY_LICENSE"
DocumentVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED"

NotificationType = "JOB_REQUEST" | "JOB_ACCEPTED" | "JOB_REJECTED" | "DRIVER_ASSIGNED"
  | "DRIVER_ARRIVED" | "JOB_STARTED" | "JOB_COMPLETED" | "JOB_CANCELLED" | "PAYMENT_RECEIVED"
  | "DRIVER_ONLINE" | "DRIVER_OFFLINE" | "VEHICLE_ASSIGNED" | "VEHICLE_MAINTENANCE"
  | "VEHICLE_DOCUMENT_EXPIRY" | "LICENSE_EXPIRY" | "SYSTEM"
// Only these are ACTUALLY emitted today: JOB_REQUEST, JOB_ACCEPTED, JOB_CANCELLED,
// DRIVER_ARRIVED, JOB_STARTED, JOB_COMPLETED. The rest exist in the enum but no code
// path sends them — do not build UI that assumes e.g. VEHICLE_MAINTENANCE notifications arrive.
NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

VehicleStatus = "AVAILABLE" | "ASSIGNED" | "ON_RECOVERY" | "MAINTENANCE" | "OFFLINE"
VehicleType = "TOW_TRUCK" | "FLATBED" | "BIKE_RECOVERY" | "BOX_RECOVERY"
            | "PICKUP" | "SERVICE_VAN" | "OTHER"
```

Business ID formats (display-only, server-generated): `CMP-000001`, `DRV-000001`, `VEH-000001`, `CUS-000001`, `SVC-000001`, `JOB-YYYYMMDD-000001`.

---

## Auth — `/auth`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{firstName,lastName,email,phone,password(min8),role}` → `{user,accessToken,refreshToken,refreshTokenExpiresAt}`. 409 on duplicate email/phone. Registering a role does NOT create the role profile — see Customer/Driver sections. |
| POST | `/auth/login` | public | `{email,password}` → same shape. 401 `"Invalid email or password"`. |
| POST | `/auth/refresh` | public | `{refreshToken}` → new rotated pair (old one revoked). 401 if invalid/expired/revoked. |
| POST | `/auth/logout` | public | `{refreshToken}` → revokes it. Always 200, even if token unknown. |
| POST | `/auth/logout-all` | bearer, any role | revokes every refresh token for the user (all devices). |

---

## Company — `/companies` (OWNER-only except lookup)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/companies/lookup/:companyCode` | bearer, any role | minimal `{companyCode,companyName,logo,city}` — used by a driver to verify a code before registering. |
| POST | `/companies` | OWNER | creates the owner's one company. 409 if they already have one. Body: `companyName,email,phone,logo?,address,city,country,tradeLicenseNumber,tradeLicenseExpiry,serviceAreas[]`. |
| GET | `/companies/me` | OWNER | full company doc. 404 if none yet. |
| PATCH | `/companies/me` | OWNER | partial update, same fields as create. |
| GET | `/companies/me/settings` | OWNER | `{operatingHours:{open,close}, defaultServiceRadiusKm, notificationPreferences:{email,sms,push}, invoiceBranding:{logoUrl?,invoicePrefix?}}`. |
| PATCH | `/companies/me/settings` | OWNER | deep-partial merge. |
| POST | `/companies/me/documents` | OWNER | multipart `file`+`documentType` → `IDocument` (ownerType COMPANY). |
| GET | `/companies/me/documents` | OWNER | `IDocument[]`, unpaginated. |

---

## Driver — `/drivers`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/drivers` | DRIVER | `{companyCode,nationalId,emiratesId,emiratesIdExpiry,drivingLicenseNumber,drivingLicenseExpiry}` → driver profile, `status:OFFLINE`, `approvalStatus:PENDING_APPROVAL`. 404 bad companyCode, 409 already has profile. |
| GET | `/drivers` | OWNER | own company's drivers. `?page&limit&approvalStatus`. |
| PATCH | `/drivers/me/location` | DRIVER | `{location:GeoPoint, speed?, heading?(0-360), accuracy?, timestamp?}` — REST fallback; same code path as the socket event. |
| PATCH | `/drivers/me/status` | DRIVER | `{status: AVAILABLE\|OFFLINE\|ON_BREAK}` only — self-service subset. `ON_JOB` is system-set; `ON_LEAVE`/`SUSPENDED` have **no endpoint at all** (admin/DB-only today). 403 if not yet APPROVED. |
| GET | `/drivers/me` | DRIVER | **Added in Phase 3** (resolves gap #10 below — previously missing). Returns the authenticated driver's own profile, identity-populated same as `GET /drivers/:id`. 404 `"Driver profile not found"` if this user never completed `POST /drivers`. No `id` param — resolved entirely from the JWT, never trusts client input. |
| GET | `/drivers/:id` | bearer | self or owning OWNER only (403 otherwise). Response has `userId` **populated** with `{firstName,lastName,email,phone,profileImage}`. |
| PATCH | `/drivers/:id` | bearer | self or owning OWNER. `{nationalId?,emiratesId?,emiratesIdExpiry?,drivingLicenseNumber?,drivingLicenseExpiry?,profileImage?}`. |
| PATCH | `/drivers/:id/approve` | OWNER (own company) | no body. |
| PATCH | `/drivers/:id/reject` | OWNER (own company) | `{reason?}`. |
| GET | `/drivers/:id/location` | bearer | self / owning OWNER / customer on an active job with this driver. `{driverId, location: GeoPoint\|null}`. Debug/fallback snapshot — live tracking should use the socket event. |
| GET | `/drivers/:id/ratings` | bearer | same access as `GET /:id`. `?page&limit` → `IRating[]`. |
| POST | `/drivers/:id/documents` | bearer | same access. multipart `file`+`documentType` → `IDocument` (ownerType DRIVER). |
| GET | `/drivers/:id/documents` | bearer | same access. |

---

## Vehicle — `/vehicles`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/vehicles` | OWNER | `{plateNumber,registrationNumber,chassisNumber,vehicleType,recoveryType:ServiceType[],insurancePolicyNumber,insuranceExpiry,registrationExpiry}`. |
| GET | `/vehicles` | OWNER | own company. `?page&limit`. |
| GET | `/vehicles/:id` | bearer | owning OWNER or the driver currently assigned to it. |
| PATCH | `/vehicles/:id` | OWNER | partial update. |
| POST | `/vehicles/:id/assign-driver` | OWNER | `{driverId}`. 409 if driver belongs to a different company. |
| POST | `/vehicles/:id/documents` | OWNER | multipart → `IDocument` (ownerType VEHICLE). |
| GET | `/vehicles/:id/documents` | bearer | owning OWNER or assigned driver. |

---

## Document verification — `/documents`

| Method | Path | Auth | Notes |
|---|---|---|---|
| PATCH | `/documents/:id/verify` | OWNER | `{status:VERIFIED\|REJECTED, rejectionReason?}` — must own the company chain the document belongs to. |

(Document **creation/listing** always happens through the owning resource's routes above — company/driver/vehicle — not a generic `/documents` collection route.)

---

## Customer — `/customers` (CUSTOMER-only)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/customers` | CUSTOMER | `{nationalId, address?}` → profile. **Hard prerequisite for `POST /jobs`** — a registered CUSTOMER user without this profile gets 404 on job creation. 409 if already exists. |
| GET | `/customers/me` | CUSTOMER | identity-populated. 404 if no profile. |
| PATCH | `/customers/me` | CUSTOMER | `{nationalId?, address?}`. |

---

## Service catalog — `/services`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/services` | bearer, any role | full catalog, unpaginated: `{serviceCode,serviceType,displayName,description?,baseFare,isAvailable}`. |
| POST | `/services` | OWNER | `{serviceType,displayName,description?,baseFare}`. **Catalog is global, not per-company.** 409 if serviceType entry already exists. |

---

## Pricing — `/pricing`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/pricing/estimate` | bearer, any role | `{serviceType,pickupLocation,destinationLocation}` → `{serviceType,distanceKm,durationMinutes,factors:[{name,amount,description}],total}`. Same engine `POST /jobs` uses internally — good for a "get a quote" screen before booking. Active factor pipeline order: Base → Distance → FuelPrice → Weather → Time → Demand (Traffic/CompanyPricing exist as files but aren't wired in). |
| GET | `/pricing/config` | OWNER | current active `IPricingConfig` (auto-creates a default if none exists). **Flagged in source as a known gap: pricing config is global across all companies**, not per-company — any OWNER can change it for everyone (no platform-admin role yet). |
| POST | `/pricing/config` | OWNER | partial fields → creates a **new version** (never mutates in place), old version's `isActive`/`effectiveTo` closed out. |

---

## Job — `/jobs`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/jobs` | CUSTOMER (rate-limited) | **`{serviceType, pickupLocation:{geo,address}, destinationLocation:{geo,address}}` — no `companyId`/`companyCode` (Gap #14, RESOLVED 2026-08-10).** The backend resolves the platform's operational company itself server-side via `DEFAULT_COMPANY_CODE` (`JobService.create`'s `resolveOperationalCompany`) — any `companyId` a client still sends is silently stripped by the Zod schema and ignored, never used to pick the company. **Destination required**, not optional. 404 if no Customer profile. **500** (not 404) if the operational company is misconfigured (env var unset, or set to a nonexistent `companyCode`) — a server-configuration problem, not something the customer did wrong; the message never names the env var. Runs pricing engine synchronously (sets `estimatedFare`/`distanceKm`/`durationMinutes`), runs a 2dsphere `$near` query for AVAILABLE+APPROVED drivers of the resolved company within `CompanySettings.defaultServiceRadiusKm` (fallback **15km**), **snapshots** matches into `offeredDriverIds` at creation time (not live-updated). `expiresAt` = now+**10min**, lazily flips PENDING→EXPIRED on next read past that. Emits `job:new-request` to the company fleet room + `JOB_REQUEST` notification to every offered driver. This is a deliberate single-operational-company simplification (see `GAP-REPORT.md` gap #14) — a future multi-company platform needs real geo-based company matching, not implemented here. |
| GET | `/jobs` | bearer, any role | scoped automatically by role (OWNER→company's jobs, DRIVER→assigned jobs, CUSTOMER→own jobs). `?page&limit&status`. |
| GET | `/jobs/:id` | bearer | customer who owns it / assigned driver / owning OWNER only. **Response includes `assignedDriver: {firstName, lastName, profileImage?, rating} \| null`** (Gap #13, RESOLVED 2026-08-13) — `null` until a driver is assigned (`ACCEPTED` onward), never email/phone (no call/message-driver affordance exists). `profileImage` reads from `Driver.profileImage` (the field `PATCH /drivers/:id` actually writes), not `User.profileImage` (confirmed dead — never written anywhere in the backend). Only `GET /jobs/:id` gets this field, not the `GET /jobs` list. |
| POST | `/jobs/:id/accept` | DRIVER | no body → `status:ACCEPTED`, sets `driverId`+`vehicleId`(if assigned). Enforces: driver approved, driver AVAILABLE, driver in `offeredDriverIds`, job not expired, **atomic race-safe** (409 `"already accepted by another driver"` if lost the race). Driver→ON_JOB, vehicle→ON_RECOVERY. Emits `job:accepted`, notifies customer. |
| POST | `/jobs/:id/reject` | DRIVER | no body → job stays PENDING (rejection doesn't transition state, just recorded); other offered drivers can still accept. |
| PATCH | `/jobs/:id/status` | bearer, but target-status-gated in service (see JOB-LIFECYCLE.md) | `{status, cancellationReason?}` (`cancellationReason` required when status=CANCELLED). |
| POST | `/jobs/:id/rating` | CUSTOMER | `{stars:1-5, review?(max500)}` — job must be COMPLETED and belong to this customer; 409 if already rated (unique index backstop). Recomputes driver's aggregate rating on success. |

---

## Notifications & device tokens — `/notifications`, `/device-tokens`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/notifications` | bearer, self only | `?page&limit&isRead(true/false)`. |
| PATCH | `/notifications/:id/read` | bearer, must own it | marks read. |
| POST | `/device-tokens` | bearer, any role | `{fcmToken, platform:IOS\|ANDROID\|WEB}` — call on every login/app launch. |

---

## Analytics — `/analytics` (OWNER-only, no pagination — aggregate reports)

Common query: `?startDate=&endDate=` (ISO strings, hand-parsed, default all-time).

| Method | Path | Response |
|---|---|---|
| GET | `/analytics/revenue` | `{startDate,endDate,totalRevenue,completedJobsCount,averageFare}` |
| GET | `/analytics/drivers` | `[{driverId,employeeId,completedJobsCount,revenue,rating,totalTrips}]` (every driver, zero-filled) |
| GET | `/analytics/fleet-utilization` | `{totalVehicles, statusBreakdown:{[VehicleStatus]:count}, vehicles:[{vehicleId,vehicleCode,completedJobsCount}]}` |

---

## Tracking — no dedicated routes

Exposed only via `PATCH /drivers/me/location` + `GET /drivers/:id/location` (REST) and the socket events (see `SOCKET-CONTRACT.md`) — both paths share one `TrackingService`. There is **no** REST endpoint for job status history timeline, fare-calculation breakdown, or location history playback — those collections (`JobStatusHistory`, `FareCalculation`, `LocationHistory`) are written internally but never read back via any API.

---

## Not implemented anywhere (confirmed absent, do not design screens assuming these exist)

- Payments/in-app payment processing of any kind
- Chat/messaging between customer and driver (the design shows a Chat screen — see `GAP-REPORT.md`)
- Push-token-scoped "mark all read", notification deletion
- Any generic document list-all-mine endpoint (documents are only listable per owning resource)
- Job history timeline / fare breakdown detail endpoints
- Setting `DriverStatus.ON_LEAVE` / `SUSPENDED` via any route
- Per-company service catalog or per-company pricing config (both are global, single-tenant-ish gaps carried over from the backend milestones)
