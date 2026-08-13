# Admill Vehicle Recovery — Final Architecture Baseline
**Status: FROZEN pending your sign-off on Section 0 (the one open call) and the added models in Section 3.6.**
**Version 1.0 — supersedes the Phase 1–4 review for all decisions marked "Approved" below.**

---

## 0. One thing I'm pushing back on before we freeze anything

Your decisions #1–#10 are internally consistent and I'm approving them as written — no notes, they're the right calls for this stage. Decision #12, though, conflicts with the folder structure we confirmed in Phase 4, and I'd be doing you a disservice as architect if I just merged the two without saying so.

**The conflict:** the original structure groups files *by layer* (`controllers/`, `services/`, `repositories/`, `routes/` — each folder holding every domain's file). Decision #12 asks for organization *by business domain* (Auth, Company, Driver, Job, Tracking...). These are two different organizing principles, and mixing them without a rule produces the worst of both — people won't know if `job.controller.ts` lives in `controllers/` or `modules/job/`.

**Recommendation: switch to feature-modules, each internally layered.** This is a stronger structure for you specifically because your own project goal is "later expanded into a multi-company fleet management platform" — a layered-only structure gets painful past ~15-20 files per layer folder (you're already close, at 10 controllers), while feature-modules scale by adding folders, not by making existing folders longer. This is also what most production Node/TypeScript services at this size actually do.

**One exception I'm keeping centralized, not modularized: `models/`.** Job, Driver, Vehicle, Customer, and Company all reference each other constantly (`Job.driverId`, `Job.vehicleId`, `Vehicle.assignedDriver`, etc.). If models live inside each feature module, you get either circular imports between modules or everyone importing everyone else's internals — which defeats the point of module boundaries. A single `models/` folder as the shared data layer, with feature modules owning their controller/service/routes/validators, gives you clean module boundaries *for behavior* without fake boundaries *for shared data*. This is a deliberate, named trade-off, not an oversight — flagging it per your own instruction not to blindly apply a pattern without justifying it.

If you'd rather have models colocated per-module anyway (some teams do, accepting the cross-import cost, e.g. via a shared `@models` barrel), say so now — it's cheap to change before Milestone 1, expensive after.

Everything else below assumes the structure in Section 1.

---

## 1. Final Folder Structure

```
admill-backend/
├── server.ts                          # entrypoint: loads config, connects DB, starts HTTP+socket server
├── src/
│   ├── app.ts                          # Express app assembly (middleware, routes, error handler)
│   │
│   ├── config/                         # environment & third-party client setup
│   │   ├── env.ts                      # Zod-validated typed env object — single source of truth
│   │   ├── database.ts                 # Mongoose connection
│   │   ├── socket.ts                   # Socket.IO server setup + auth middleware for sockets
│   │   ├── cloudinary.ts
│   │   └── firebase.ts                 # FCM admin SDK init
│   │
│   ├── common/                         # cross-cutting, shared by every module
│   │   ├── constants/                  # ✅ existing enums, unchanged
│   │   ├── interfaces/                 # ✅ existing + 5 new interfaces (Section 3.6)
│   │   ├── errors/
│   │   │   └── AppError.ts
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts      # verifies JWT, attaches req.user
│   │   │   ├── rbac.middleware.ts      # role-based route guarding
│   │   │   ├── validate.middleware.ts  # generic Zod-schema validator
│   │   │   ├── error.middleware.ts     # global error handler (last middleware)
│   │   │   ├── rateLimiter.middleware.ts
│   │   │   └── requestLogger.middleware.ts
│   │   ├── responses/
│   │   │   └── ApiResponse.ts          # standard envelope builder
│   │   ├── utils/
│   │   │   ├── bcrypt.ts
│   │   │   ├── jwt.ts
│   │   │   ├── logger.ts
│   │   │   ├── geo.ts                  # haversine fallback, GeoJSON helpers
│   │   │   ├── pagination.ts
│   │   │   └── schema/                 # ✅ existing (mongooseOptions, softDelete, timestamps, generateBusinessId)
│   │   └── types/
│   │       ├── express.d.ts            # extends Request with `user`
│   │       └── global.d.ts
│   │
│   ├── models/                         # shared data layer — see Section 0 rationale
│   │   ├── user.model.ts
│   │   ├── company.model.ts
│   │   ├── companySettings.model.ts    # NEW — see 3.6
│   │   ├── customer.model.ts
│   │   ├── driver.model.ts
│   │   ├── vehicle.model.ts
│   │   ├── service.model.ts
│   │   ├── job.model.ts
│   │   ├── jobStatusHistory.model.ts   # NEW
│   │   ├── fareCalculation.model.ts    # NEW
│   │   ├── rating.model.ts             # NEW
│   │   ├── notification.model.ts       # NEW
│   │   ├── document.model.ts           # NEW
│   │   ├── deviceToken.model.ts        # NEW — see 3.6
│   │   ├── refreshToken.model.ts       # NEW — see 3.6
│   │   ├── pricingConfig.model.ts      # NEW — see 3.6
│   │   ├── locationHistory.model.ts    # NEW — sampled GPS history, see Section 6
│   │   └── counter.model.ts            # NEW — atomic sequence generator, see 3.6
│   │
│   ├── repositories/                   # one per model — thin data access, no business logic
│   │   └── ...one file per model above
│   │
│   └── modules/                        # feature modules — the domain organization you asked for
│       ├── auth/
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── auth.routes.ts
│       │   └── auth.validator.ts
│       ├── company/
│       │   ├── company.controller.ts
│       │   ├── company.service.ts
│       │   ├── company.routes.ts
│       │   └── company.validator.ts
│       ├── customer/    (controller, service, routes, validator)
│       ├── driver/      (controller, service, routes, validator)
│       ├── vehicle/     (controller, service, routes, validator)
│       ├── job/         (controller, service, routes, validator — the dispatch orchestrator)
│       ├── tracking/
│       │   ├── tracking.service.ts     # abstraction boundary — see Section 6
│       │   ├── tracking.routes.ts      # REST fallback (e.g., last-known-location lookup)
│       │   └── tracking.socket.ts
│       ├── pricing/
│       │   ├── pricing.service.ts      # orchestrates factor strategies
│       │   ├── pricing.routes.ts       # fare-estimate endpoint
│       │   └── factors/
│       │       ├── baseFare.factor.ts
│       │       ├── distance.factor.ts
│       │       ├── fuelPrice.factor.ts
│       │       ├── rushHour.factor.ts
│       │       ├── weather.factor.ts
│       │       └── surge.factor.ts     # stubbed now, real in a later milestone
│       ├── notification/
│       │   ├── notification.service.ts
│       │   ├── notification.routes.ts
│       │   └── notification.socket.ts
│       ├── document/
│       │   ├── document.controller.ts
│       │   ├── document.service.ts
│       │   └── document.routes.ts
│       ├── rating/
│       │   ├── rating.controller.ts
│       │   ├── rating.service.ts
│       │   └── rating.routes.ts
│       └── analytics/
│           ├── analytics.controller.ts
│           ├── analytics.service.ts
│           └── analytics.routes.ts
│
├── routes/v1/index.ts                  # mounts every module's router under /api/v1/*
├── socket/index.ts                     # mounts every module's socket namespace
├── tests/
│   ├── unit/                           # one subfolder per module, mirrors modules/
│   ├── integration/
│   └── fixtures/
└── uploads/                            # local fallback only; Cloudinary is primary storage
```

**Rule of thumb going forward:** if a file is about *how one domain behaves* (validating a driver registration, dispatching a job), it goes in `modules/<domain>/`. If it's *shared data* or *infrastructure every module needs*, it goes in `models/`, `repositories/`, or `common/`. When in doubt, ask "would two different modules need to import this?" — if yes, it's common/shared; if no, it belongs inside the one module that owns it.

---

## 2. Complete Dependency Flow

```
Route (modules/x/x.routes.ts)
   │  applies: auth.middleware → rbac.middleware → validate.middleware(schema)
   ▼
Controller (modules/x/x.controller.ts)
   │  parses req, calls service, wraps result in ApiResponse — no business logic, no direct DB access
   ▼
Service (modules/x/x.service.ts)
   │  business logic, orchestrates multiple repositories, calls other services (e.g. Job service calls Pricing service)
   ▼
Repository (repositories/x.repository.ts)
   │  Mongoose queries only — find/create/update, no business rules
   ▼
Model (models/x.model.ts) → MongoDB Atlas
```

**Hard rule:** controllers never import repositories directly, and repositories never import services. Violating either collapses the layering and is the #1 way these architectures rot over 6 months. If a controller needs data shaped two different ways for two endpoints, that's two service methods, not the controller reaching around the service.

Cross-service calls (e.g., `JobService` needs `PricingService.calculateFare()`, or `JobService` needs `NotificationService.notifyDriver()`) are fine and expected — services calling services is normal; controllers calling other modules' repositories is not.

---

## 3. Database Architecture

### 3.1 Geospatial standardization (Decision #1 — implemented)

Every location field becomes:
```ts
interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude] — GeoJSON order, NOT lat/lng
}
```
Applied to: `Customer.currentLocation`, `Driver.currentLocation`, `Vehicle.currentLocation` (if vehicles need independent tracking from their driver — see open question in 3.7), `Job.pickupLocation.geo`, `Job.destinationLocation.geo`, `LocationHistory.location`. Each of these gets a `2dsphere` index. The human-readable `address: string` stays alongside `geo`, never replacing it — you need both (query by proximity, display by address).

### 3.2 Owner modeling (Decision #3 — implemented)
No `Owner` collection. `User.role = OWNER`. `Company.ownerId → User._id`. `DatabaseSchema.md` gets corrected to drop the standalone `owners` line.

### 3.3 Identity ownership (Decision #4 — implemented)
`User` holds: `firstName`, `lastName`, `email`, `phone`, `password`, `role`, `profileImage`, `lastLogin`. Nothing else anywhere stores a name, email, or phone. `Customer`, `Driver` hold only role-specific fields (ratings, license numbers, employment data) plus `userId` reference. Any endpoint returning a "driver profile" or "customer profile" does a `.populate('userId')` (or an explicit repository join) at the service layer — never duplicate identity fields onto role documents, even for "performance," until you have a measured reason to.

### 3.4 Live tracking storage (Decision #2 — see Section 6, this is the big one)

### 3.5 Pricing data (Decision #6 support)
Dynamic pricing factors need a *source of truth* that isn't hardcoded in the pricing engine's code — that would violate your own "extensible without changing core logic" requirement, because someone would have to redeploy the backend to change the fuel price. New model: `PricingConfig` (Section 3.6).

### 3.6 New / additional models

Your approved five, plus **five more I'm recommending** — each with a specific reason, not just "more is thorough":

| Model | Purpose | Why it's needed now, not later |
|---|---|---|
| `Notification` *(your list)* | Persisted notification record (title, body, type, priority, isRead, receiverId) | Approved |
| `Rating` *(your list)* | stars, review, jobId, customerId, driverId | Approved |
| `Document` *(your list)* | Polymorphic: `ownerType` (DRIVER/VEHICLE/COMPANY), `ownerId`, `documentType`, `fileUrl`, `expiryDate`, `verificationStatus` | Approved — polymorphic per our earlier agreement, one approval queue for the Business Owner |
| `JobStatusHistory` *(your list)* | Append-only log of every `Job.status` transition with timestamp + actor | Approved |
| `FareCalculation` *(your list)* | Per-job breakdown: each factor's contribution + total, linked to `jobId` | Approved |
| `PricingConfig` **(new)** | Company- (or global-) level current fuel price, rush-hour windows, per-service base fares, surge toggle | Without this, "current fuel price" and "rush hour multiplier" have nowhere to live except hardcoded constants — directly undermines Decision #6's extensibility goal |
| `RefreshToken` **(new)** | One document per active refresh token: `userId`, `tokenHash`, `deviceInfo`, `expiresAt`, `revokedAt` | A single `refreshToken` string field on `User` (the old design) can't support "log out this one device" or "log out everywhere," and can't be revoked individually — a real security gap for a driver's lost phone. This directly strengthens Decision #7. |
| `DeviceToken` **(new)** | `userId`, `fcmToken`, `platform`, `lastUsedAt` | FCM push requires a token per device; a user field can't hold multiple devices cleanly, and tokens rotate/expire independently of the user record |
| `CompanySettings` **(new)** | Operating hours, default service radius, notification preferences, invoice/branding config | Your requirement explicitly lists "Configure company settings" as a Business Owner capability, and a `settings.routes.ts` file already exists in the baseline — this gives it a real model instead of overloading `Company` |
| `Counter` **(new)** | `_id: sequenceName`, `value: number` | `generateBusinessId` needs an atomic, race-safe sequence source (`findOneAndUpdate` with `$inc`) — without it, two jobs created in the same millisecond can generate the same `jobNumber` under concurrent load |

I'd genuinely push back if you wanted to skip `RefreshToken` or `Counter` specifically — those two are correctness/security issues, not nice-to-haves. `PricingConfig`, `DeviceToken`, and `CompanySettings` I'm confident in but they're lower-stakes if you'd rather fold them into an existing model instead; say so and I'll adjust before Milestone 1.

### 3.7 One open question I don't have enough information to decide for you
Does a `Vehicle` track its own GPS position independently of its assigned `Driver` (e.g., a dashcam/telematics unit), or is "vehicle location" always just "wherever its currently assigned driver is"? Your requirements list "Track all drivers" for the Business Owner but not explicitly "track all vehicles" as a separate feed. I've modeled `Vehicle.currentLocation` as optional above on the assumption that vehicle position = driver position for V1 (no separate hardware), but confirm before Milestone 1 — it changes whether `LocationHistory` keys off `driverId`, `vehicleId`, or both.

---

## 4. Authentication Architecture (Decision #7)

- **Access token:** JWT, ~15 min expiry, payload: `{ sub: userId, role, iat, exp }`. Sent as `Authorization: Bearer <token>`.
- **Refresh token:** opaque random string (not a JWT — no need for it to be self-describing), ~30 day expiry, stored **hashed** (bcrypt or SHA-256) in the new `RefreshToken` collection, sent to the client as an httpOnly, secure, sameSite cookie (mobile clients: secure storage, e.g. Keychain/Keystore, not cookies — React Native doesn't have cookie jars the same way, so the mobile app stores it via `react-native-keychain` and sends it explicitly on refresh calls).
- **Rotation:** every refresh-token use issues a new refresh token and revokes the old one (`revokedAt` set), preventing replay of a stolen-then-used token.
- **Login flow:** `POST /auth/login` → verify password (bcrypt) → issue access + refresh → create `RefreshToken` doc → return access token in body, refresh token as described above.
- **Refresh flow:** `POST /auth/refresh` → look up hashed token → check not revoked/expired → rotate → issue new pair.
- **Logout:** revoke the specific `RefreshToken` doc (single device) or all docs for that `userId` (logout everywhere — exposed as a distinct endpoint, e.g. for "I lost my phone").

## 5. Authorization Flow

`auth.middleware.ts` verifies the JWT and attaches `req.user = { id, role }`. `rbac.middleware.ts` is a factory: `requireRole(UserRole.OWNER)` or `requireRole(UserRole.OWNER, UserRole.DRIVER)`, used per-route. Ownership checks beyond role (e.g., "this driver can only update *their own* job") happen in the service layer, not middleware — middleware answers "is this role allowed to hit this endpoint at all," services answer "is this specific user allowed to touch this specific record."

```
Route → auth.middleware (401 if invalid/missing token)
      → rbac.middleware(...roles) (403 if role not permitted)
      → validate.middleware(zodSchema) (400 if payload invalid)
      → controller → service (service enforces record-level ownership, 403/404 as appropriate)
```

## 6. Tracking Architecture (Decision #2 — the Redis-deferred design)

This is the part that needs the most care, because "make it swappable later" is a real constraint, not a platitude — it means the module boundary has to be right *now*, even though the implementation behind it is simple.

**The abstraction:** `TrackingService` exposes an interface that never leaks its storage mechanism:

```ts
interface ITrackingStore {
  updateDriverPosition(driverId: string, point: IGeoPoint, meta: { speed?, heading?, timestamp }): Promise<void>;
  getDriverPosition(driverId: string): Promise<IGeoPoint | null>;
  findNearbyDrivers(point: IGeoPoint, radiusKm: number, filters: { status: DriverStatus }): Promise<DriverWithDistance[]>;
}
```

**V1 implementation — `MongoTrackingStore implements ITrackingStore`:**
- `updateDriverPosition`: updates a single field, `Driver.currentLocation`, in place (upsert-style — this is a *mutation*, not an insert, so it doesn't create a new document per ping). This is the key difference from the old design: one document per driver, always overwritten, not one document per ping.
- `findNearbyDrivers`: a single `$geoNear`/`$near` query against `Driver.currentLocation` (2dsphere-indexed), filtered by `status: AVAILABLE`.
- `getDriverPosition`: simple `findById` projection.
- **Sampled history, separately:** while a job is `EN_ROUTE` or `STARTED`, the socket handler additionally writes to `LocationHistory` at a reduced rate (e.g., one write per 15–30 seconds, or on meaningful heading change) — this is what powers trip playback/audit later, and it's an explicit, capped write pattern, not "every ping forever."

**Data flow:**
```
Driver App (GPS every ~3-5s)
   → Socket.IO event "driver:location:update" { lat, lng, speed, heading }
   → tracking.socket.ts handler
        → TrackingService.updateDriverPosition()  [mutates Driver.currentLocation in Mongo]
        → if job active: rate-limited write to LocationHistory
        → io.to(`job:${jobId}`).emit("driver:location:changed", {...})   [customer tracking this job]
        → io.to(`company:${companyId}:fleet`).emit("driver:location:changed", {...})  [owner dashboard]
```

**The Redis upgrade path, concretely:** when you outgrow this, you write `RedisTrackingStore implements ITrackingStore` (GEOADD/GEOSEARCH instead of Mongo queries), and change **one line** — the store implementation injected into `TrackingService` (constructor injection or a factory keyed off `config.env.TRACKING_STORE`). No controller, socket handler, or route changes, because they only ever call `TrackingService`, never the store directly. That one line is the entire migration. This is the concrete mechanism behind "pluggable later" — not a vague intention, an actual seam in the code.

**Why this is safe at MVP scale:** a single in-place `updateOne` per driver (not an insert) is a cheap, indexed write regardless of frequency — the earlier scaling concern was about *unbounded document growth* from history-per-ping, which this design avoids by construction. You'll want to revisit this once you're past roughly 200-300 concurrently-online drivers pinging every few seconds, purely on Atlas connection/throughput limits for your tier — well past where a UAE roadside-assistance MVP will be at launch.

## 7. Pricing Engine Architecture (Decision #6)

```ts
interface IPricingFactor {
  name: string;
  calculate(context: PricingContext): FactorResult; // { amount: number, description: string }
}

class PricingService {
  private factors: IPricingFactor[] = [
    new BaseFareFactor(),
    new DistanceFactor(),
    new FuelPriceFactor(),
    new RushHourFactor(),
    new WeatherFactor(),
    // new SurgeFactor() — added later, zero changes to the four lines above
  ];

  calculateFare(context: PricingContext): FareBreakdown {
    const results = this.factors.map(f => f.calculate(context));
    return { factors: results, total: sum(results), context };
  }
}
```

`PricingContext` carries everything a factor might need (distance, serviceType, current fuel price from `PricingConfig`, timestamp, weather lookup result) so factors stay pure and independently testable — you can unit test `RushHourFactor` without touching the database. `JobService` calls `pricingService.calculateFare(context)` once, at quote time and again at completion time (distance/duration may differ from estimate), and persists the result to `FareCalculation`, linked to the job. Adding `SurgeFactor` later means adding one class to the array — `JobService` never changes, which is exactly your requirement.

## 8. Repository Pattern

One repository per model, exposing only data operations: `findById`, `findMany(filter, pagination)`, `create`, `updateById`, `softDelete` (sets `isDeleted: true`, never a real Mongo delete, consistent with the `IBase` pattern already in place). No repository method contains an `if` statement about business rules — "is this driver eligible" is a service concern; "fetch drivers matching this filter" is a repository concern.

## 9. Service Layer Responsibilities
All business rules, orchestration across repositories, and cross-module calls (Job service calling Pricing and Notification services). Services throw `AppError` for business-rule violations (e.g., "driver already has an active job") — they don't return `{ error: ... }` objects; the global error middleware is the single place HTTP status codes get decided from error type.

## 10. Controller Responsibilities
Parse/validate-adjacent glue only: extract `req.params`/`req.body`/`req.user`, call exactly one service method, wrap the result with `ApiResponse.success(...)`, and `next(err)` (or just `throw`, given Express 5) on failure. A controller method should be short enough to read in one glance — if it's doing `if/else` business branching, that logic belongs in the service.

## 11. Validation Architecture
Zod schemas live in each module (e.g., `modules/driver/driver.validator.ts`), applied via the shared `validate.middleware.ts` factory: `validate(createDriverSchema)`. Validation happens **before** the controller runs, so controllers can trust `req.body`'s shape completely. Shared sub-schemas (e.g., a `geoPointSchema`, `paginationQuerySchema`) live in `common/utils` or a `common/validators` file to avoid duplicating the GeoJSON shape check in five different validators.

## 12. Error Handling Architecture (Decision #8)
```ts
class AppError extends Error {
  constructor(public statusCode: number, message: string, public isOperational = true) { super(message); }
}
```
Services/controllers throw `AppError` for expected failures (404 not found, 409 conflict, 403 forbidden). Anything else (a genuine bug, a driver crash) is an *unexpected* error — the global middleware catches both, but only exposes `message` to the client for `isOperational: true` errors; unexpected errors get logged with full stack trace and a generic "something went wrong" reaches the client, so internal details never leak. Express 5's native async-rejection propagation means you write `throw new AppError(...)` inside an `async` controller/service with no `try/catch` boilerplate — it reaches the error middleware automatically.

## 13. Logging Strategy
Structured logging (e.g., `pino` or `winston` — pick one; both are free and fine, `pino` is lower-overhead if request volume matters later) with levels (`error`, `warn`, `info`, `debug`), request-scoped correlation IDs (attach a `requestId` in `requestLogger.middleware.ts`, include it in every log line for that request so you can trace one API call through service → repository logs). Never log passwords, tokens, or full request bodies containing PII — log IDs and event names, not payloads.

## 14. Configuration Management (Decision #10)
`common/config/env.ts` defines a Zod schema for every required env var (`PORT`, `NODE_ENV`, `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `CLOUDINARY_*`, `FCM_*`, `FRONTEND_URL`), parses `process.env` through it at import time, and **throws immediately on boot** if anything's missing or malformed — you get one clear startup error instead of a runtime crash on the third request. Every other file imports the parsed, typed `env` object from here — nothing else touches `process.env` directly.

## 15. File Upload Architecture
`multer` (already a dependency) handles multipart parsing into memory/temp disk, `upload.middleware.ts` restricts file type (images/PDFs for documents) and size before anything touches Cloudinary. Uploaded files go straight to Cloudinary (never persisted long-term on the server's local disk — the `uploads/` folder is a transient buffer only), and the returned Cloudinary URL is what's stored on `Document.fileUrl` / `User.profileImage` / `Vehicle` photos. Cloudinary's free tier is enough for MVP volume; this needs no change when you outgrow it besides raising the paid tier.

## 16. Notification Architecture
`NotificationService` is the single entry point every other service calls (`notificationService.notify(userId, type, payload)`) — it never gets called from controllers directly. Internally it: (1) persists a `Notification` document, (2) looks up the user's `DeviceToken`(s) and sends via FCM for push, (3) emits a Socket.IO event on that user's private room (`user:${userId}`) if they're currently connected, for in-app real-time badges. Push and socket are both best-effort — a failed FCM send never blocks the underlying business action (e.g., a job's status still updates even if the push notification fails).

## 17. Socket.IO Architecture
Namespaced by concern, matching your module boundaries:
- `/tracking` — driver location pings, subscriptions to a job's or company's live feed
- `/job` — job offer broadcast to nearby drivers, accept/reject, status updates
- `/notification` — real-time delivery of the in-app notification described above

Every socket connection authenticates via the same JWT access token (passed at handshake, verified once via a Socket.IO auth middleware — not per-event) and joins role/entity-scoped rooms on connect (`user:${userId}`, and for drivers `company:${companyId}:fleet`; for an active job, both the assigned driver and the requesting customer join `job:${jobId}`).

## 18. API Versioning
Already correctly structured (`routes/v1/`). All new endpoints go under `/api/v1/*` until a breaking change is genuinely required, at which point `routes/v2/` is added alongside — v1 is never modified in a breaking way once a mobile app build depends on it, since you can't force-update a released app instantly.

## 19. Standard API Response Format (Decision #9)
```ts
// Success
{ success: true, data: <payload>, message?: string, meta?: { page, limit, total } }
// Error (from error.middleware.ts)
{ success: false, message: string, errors?: ValidationErrorDetail[] }
```
One `ApiResponse.success(data, message?, meta?)` / the error middleware builds the error shape — no controller hand-rolls a response object.

**Pagination:** every list endpoint accepts `?page=&limit=` (sane defaults, capped max limit server-side so nobody requests 100,000 records), and returns `meta.total`/`meta.page`/`meta.limit` so mobile clients can build standard pagination UI without guessing.

## 20. Security Best Practices
- `helmet` (already a dependency) for standard headers.
- `express-rate-limit` (already a dependency) on auth endpoints especially (`/login`, `/refresh`) to blunt brute-force/credential-stuffing.
- Input validation (Zod) on every mutating endpoint — never trust client-supplied IDs without checking ownership in the service layer.
- Passwords: bcrypt only (drop `bcryptjs` per the earlier review), never logged, never returned in any API response (exclude via Mongoose `select: false` on the field, or an explicit DTO strip).
- CORS locked to the actual mobile app's origin/scheme in production, not `*`.
- File upload validation (type/size) before anything reaches Cloudinary, to avoid arbitrary file hosting via your API.
- Secrets (`JWT_*_SECRET`, Cloudinary keys, FCM keys) only in env vars, validated at boot (Section 14), never committed — fix the `.env`/`.env.example` gap from the earlier review before Milestone 1.

## 21. Deployment Architecture
For a budget-conscious MVP: a single Node process on a low-cost host (Railway, Render, or a small EC2/Lightsail instance) behind the platform's built-in HTTPS, MongoDB Atlas free/shared tier, Cloudinary free tier, Firebase free tier for FCM. Socket.IO on a single instance needs no sticky-session or Redis-adapter configuration — that requirement only appears once you horizontally scale to multiple backend instances, which is itself a "future scalability" item below, not a V1 concern. CI: a simple GitHub Actions workflow running `tsc --noEmit`, `eslint`, and tests on every PR before merge — cheap to add now, expensive to retrofit onto a team habit of not doing it.

## 22. Future Scalability Considerations
- **Tracking:** swap `MongoTrackingStore` → `RedisTrackingStore` behind the existing `ITrackingStore` interface (Section 6) — no other code changes.
- **Socket.IO horizontal scaling:** once you run more than one backend instance, add the Redis Socket.IO adapter (same Redis instance you'd add for tracking — natural pairing, not a second new dependency).
- **Multi-company platform:** the `companyId` foreign key already exists on every relevant model (`Driver`, `Vehicle`, `Job`) — the data model already supports multi-tenancy; the remaining work when you get there is company-scoped query enforcement (ensuring a company's dashboard can never see another company's jobs) and possibly a `Platform Admin` role above `Owner`.
- **Payments (explicitly deferred by you):** the `FareCalculation` model and `Job.finalFare` already give you the exact amount to charge when you add a payment provider — no schema rework needed, just a new `Payment` model referencing `jobId`.
- **Surge pricing:** already a documented placeholder in the pricing engine (Section 7) — adding it later touches only `factors/surge.factor.ts` and `PricingConfig`.

---

## 23. Implementation Roadmap

Milestone order follows dependency order (you can't build Job before Driver+Vehicle+Customer exist; you can't build Pricing usefully before Service+PricingConfig exist). Each milestone is meant to be fully shippable/testable before the next starts, per your instruction not to skip ahead.

---

### Milestone 0 — Environment & Foundation
**Objective:** A running server with zero business features, but every cross-cutting concern wired correctly, so every later milestone builds on solid ground instead of retrofitting it.

- **Features:** typed env validation, DB connection, global error handling, standard response envelope, logger, health check.
- **Files to create:** `common/config/env.ts`, `config/database.ts`, `common/errors/AppError.ts`, `common/responses/ApiResponse.ts`, `common/middlewares/error.middleware.ts`, `common/middlewares/requestLogger.middleware.ts`, `common/utils/logger.ts`, `src/app.ts`
- **Files to modify:** `server.ts` (replace stub with real bootstrap), `.env` / `.env.example` (create for real)
- **Models involved:** none yet
- **Services involved:** none yet
- **Controllers:** none yet (health check can stay inline in `app.ts`)
- **Routes:** `GET /health`
- **Socket events:** none
- **Testing checklist:** server boots and exits cleanly if a required env var is missing; `/health` returns the standard envelope; a deliberately-thrown `AppError` in a temporary test route returns the correct status + shape; an unhandled error returns a generic message with no stack trace leak, while the full error is visible in logs.
- **Definition of Done:** `npm run dev` boots with no errors against a real Atlas connection string, `/health` works, and error handling has been manually verified with both an operational and a non-operational thrown error.

---

### Milestone 1 — Auth & Identity
**Objective:** All three roles can register and log in; JWT access+refresh works end-to-end; RBAC middleware is provably enforcing roles.

- **Features:** registration (role-aware), login, refresh, logout (single-device + all-devices), RBAC guard.
- **Files to create:** `models/user.model.ts`, `models/refreshToken.model.ts`, `repositories/user.repository.ts`, `repositories/refreshToken.repository.ts`, `modules/auth/*` (controller, service, routes, validator), `common/middlewares/auth.middleware.ts`, `common/middlewares/rbac.middleware.ts`, `common/utils/jwt.ts`, `common/utils/bcrypt.ts`
- **Files to modify:** `routes/v1/index.ts` (mount auth routes), `common/types/express.d.ts` (add `user` to `Request`)
- **Models involved:** `User`, `RefreshToken`
- **Services involved:** `AuthService`
- **Controllers:** `AuthController`
- **Routes:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`
- **Socket events:** none
- **Testing checklist:** register succeeds for each role and rejects duplicate email/phone; login rejects wrong password; access token expires and refresh correctly rotates; a revoked refresh token can't be reused; RBAC-protected test route correctly 403s the wrong role.
- **Definition of Done:** a Postman/Thunder collection demonstrating the full auth lifecycle for all three roles, including a deliberately-failed refresh-reuse attempt returning 401.

---

### Milestone 2 — Company & Settings
**Objective:** A Business Owner can stand up their company profile end-to-end.

- **Files to create:** `models/company.model.ts`, `models/companySettings.model.ts`, `models/counter.model.ts`, `repositories/company.repository.ts`, `repositories/companySettings.repository.ts`, `modules/company/*`
- **Models involved:** `Company`, `CompanySettings`, `Counter`
- **Services involved:** `CompanyService` (uses `Counter` for `companyCode` generation)
- **Controllers:** `CompanyController`
- **Routes:** `POST /companies`, `GET /companies/me`, `PATCH /companies/me`, `GET /companies/me/settings`, `PATCH /companies/me/settings`
- **Socket events:** none
- **Testing checklist:** company creation auto-generates a unique `companyCode` even under simulated concurrent creation (tests the `Counter` atomicity specifically); only `OWNER` role can create/edit; settings default sensibly if never configured.
- **Definition of Done:** an owner account can register a company, fetch it, update it, and update settings — all role-gated correctly.

---

### Milestone 3 — Driver, Vehicle & Document Management
**Objective:** Full driver/vehicle onboarding and the document-approval workflow.

- **Files to create:** `models/driver.model.ts`, `models/vehicle.model.ts`, `models/document.model.ts`, corresponding repositories, `modules/driver/*`, `modules/vehicle/*`, `modules/document/*`, `common/middlewares/upload.middleware.ts`, `config/cloudinary.ts`
- **Models involved:** `Driver`, `Vehicle`, `Document`
- **Services involved:** `DriverService`, `VehicleService`, `DocumentService`
- **Controllers:** `DriverController`, `VehicleController`, `DocumentController`
- **Routes:** `POST /drivers` (self-register), `GET/PATCH /drivers/:id`, `POST /drivers/:id/documents`, `PATCH /documents/:id/verify` (owner-only approval), `POST /vehicles`, `GET/PATCH /vehicles/:id`, `POST /vehicles/:id/assign-driver`
- **Socket events:** none yet (tracking comes later)
- **Testing checklist:** driver can't go online (future milestone) until at least required documents are `VERIFIED`; document upload correctly restricts file type/size and lands in Cloudinary; only `OWNER` can verify documents or assign vehicles; expired `emiratesIdExpiry`/`insuranceExpiry` are queryable (for the future cron job).
- **Definition of Done:** a driver registers, uploads documents, an owner approves them, a vehicle is created and assigned to that driver — full happy path plus the rejection path (owner rejects a document, driver re-uploads).

---

### Milestone 4 — Customer Module
**Objective:** Customer registration and profile.

- **Files to create:** `models/customer.model.ts`, `repositories/customer.repository.ts`, `modules/customer/*`
- **Models involved:** `Customer`
- **Services involved:** `CustomerService`
- **Controllers:** `CustomerController`
- **Routes:** `POST /customers`, `GET/PATCH /customers/me`
- **Socket events:** none
- **Testing checklist:** customer profile correctly populates identity from `User`; `averageRating`/`totalJobs` default correctly and are read-only via this API (only the Rating flow, Milestone 8, can change them).
- **Definition of Done:** customer registration + profile CRUD working, identity fields confirmed as never duplicated onto `Customer`.

---

### Milestone 5 — Service Catalog & Pricing Engine
**Objective:** Configurable services and a working, isolated fare-estimate endpoint — without a job existing yet.

- **Files to create:** `models/service.model.ts`, `models/pricingConfig.model.ts`, `repositories/service.repository.ts`, `repositories/pricingConfig.repository.ts`, `modules/pricing/*` (service + all `factors/*.ts`), `modules/company/` additions for managing `PricingConfig`
- **Models involved:** `Service`, `PricingConfig`
- **Services involved:** `PricingService`, `ServiceService` (or fold catalog CRUD into `CompanyService` — small enough either way, your call)
- **Controllers:** `PricingController` (fare estimate endpoint), service-catalog CRUD controller
- **Routes:** `GET /services`, `POST /services` (owner-only), `POST /pricing/estimate` (body: pickup, destination, serviceType → returns `FareBreakdown` without creating a job)
- **Socket events:** none
- **Testing checklist:** each factor is unit-testable in isolation with a mocked `PricingContext`; rush-hour multiplier only applies inside configured windows; changing `PricingConfig.currentFuelPrice` changes the next estimate with zero code deploy; adding a dummy 6th factor to the array doesn't require touching any other file (this is the actual acceptance test for Decision #6's core promise).
- **Definition of Done:** `/pricing/estimate` returns a correct, itemized breakdown for at least two different services and two different times of day (rush vs. non-rush), verified against manually-calculated expected totals.

---

### Milestone 6 — Job Lifecycle & Dispatch
**Objective:** The core product loop — request → nearby drivers → accept → status progression — is live.

- **Files to create:** `models/job.model.ts`, `models/jobStatusHistory.model.ts`, `models/fareCalculation.model.ts`, corresponding repositories, `modules/job/*`, `modules/job/job.socket.ts`
- **Models involved:** `Job`, `JobStatusHistory`, `FareCalculation`
- **Services involved:** `JobService` (calls `PricingService`, will call `NotificationService` once M8 exists — stub/no-op the notification call until then, or build M6/M8 in either order if you prefer notifications first)
- **Controllers:** `JobController`
- **Routes:** `POST /jobs` (create request), `POST /jobs/:id/accept`, `POST /jobs/:id/reject`, `PATCH /jobs/:id/status`, `GET /jobs/:id`, `GET /jobs` (history, paginated)
- **Socket events:** `job:new-request` (emitted to nearby available drivers' room), `job:accepted`, `job:status-changed`
- **Testing checklist:** job creation calls `PricingService` and persists a `FareCalculation`; nearby-driver query correctly uses the `2dsphere` index and filters by `AVAILABLE` status; every status transition writes a `JobStatusHistory` entry; a driver can't accept a job already accepted by someone else (race condition test — two simultaneous accept calls, only one should succeed).
- **Definition of Done:** full lifecycle demonstrable end-to-end (Postman/socket client) from job creation through completion, including the concurrent-accept race test passing correctly.

---

### Milestone 7 — Real-Time Tracking
**Objective:** Live driver location flows to customer and owner dashboards per the Section 6 design.

- **Files to create:** `models/locationHistory.model.ts`, `repositories/locationHistory.repository.ts`, `modules/tracking/tracking.service.ts` (with `ITrackingStore` interface + `MongoTrackingStore` implementation), `modules/tracking/tracking.socket.ts`, `modules/tracking/tracking.routes.ts`
- **Models involved:** `Driver.currentLocation` (field update, not a new model), `LocationHistory`
- **Services involved:** `TrackingService`
- **Controllers:** none required if fully socket-driven; optional `TrackingController` for a REST "last known location" fallback
- **Routes:** `GET /drivers/:id/location` (fallback/debug)
- **Socket events:** `driver:location:update` (inbound, from driver app), `driver:location:changed` (outbound, to job room + fleet room)
- **Testing checklist:** rapid location updates correctly overwrite `Driver.currentLocation` rather than creating documents; sampled `LocationHistory` writes are rate-limited as designed (verify write count over a simulated 5-minute active job); a customer only receives location updates for their own active job's driver, never others'; owner fleet room receives updates for all their company's drivers.
- **Definition of Done:** a simulated driver client emitting fake GPS pings produces correct real-time updates on both a "customer" and an "owner" test client, with `LocationHistory` growing at the expected sampled rate, not per-ping.

---

### Milestone 8 — Notifications
**Objective:** Push + in-app notifications work for the key job lifecycle events.

- **Files to create:** `models/notification.model.ts`, `models/deviceToken.model.ts`, corresponding repositories, `modules/notification/*`, `config/firebase.ts`
- **Models involved:** `Notification`, `DeviceToken`
- **Services involved:** `NotificationService`
- **Controllers:** `NotificationController` (list/mark-read)
- **Routes:** `POST /device-tokens` (register on app login), `GET /notifications` (paginated), `PATCH /notifications/:id/read`
- **Socket events:** `notification:new`
- **Testing checklist:** a job-status change (from M6) triggers the correct notification type to the correct user; failed FCM send doesn't throw/block the calling job-status-update request; unread count is correctly queryable; a user with multiple `DeviceToken`s gets the push on all of them.
- **Definition of Done:** triggering a job status change produces a persisted `Notification`, a real push (test device), and a real-time socket event, all three, without blocking the job update itself if any one of the three fails.

---

### Milestone 9 — Ratings & Job Completion
**Objective:** Customers rate completed jobs; driver aggregate ratings update correctly.

- **Files to create:** `models/rating.model.ts`, `repositories/rating.repository.ts`, `modules/rating/*`
- **Models involved:** `Rating`, `Driver` (rating/totalTrips fields updated)
- **Services involved:** `RatingService`
- **Controllers:** `RatingController`
- **Routes:** `POST /jobs/:id/rating`, `GET /drivers/:id/ratings`
- **Socket events:** none required
- **Testing checklist:** rating only allowed on `COMPLETED` jobs, only by that job's customer, only once; driver's `rating`/`totalTrips` recompute correctly (verify the average math against a hand-calculated example with 3+ ratings).
- **Definition of Done:** end-to-end: complete a job, submit a rating, verify the driver's aggregate rating updated correctly and a second rating attempt on the same job is rejected.

---

### Milestone 10 — Analytics & Reporting
**Objective:** Business Owner dashboard data — revenue, driver stats, fleet utilization.

- **Files to create:** `modules/analytics/*` (likely aggregation-heavy service methods against existing models — no new core models expected, though a `analytics.dto.ts` for response shaping is useful)
- **Models involved:** aggregates across `Job`, `FareCalculation`, `Driver`, `Vehicle`, `Rating` — no new collections unless a specific report needs materialized/cached results at scale (defer that until a real performance need appears)
- **Services involved:** `AnalyticsService`
- **Controllers:** `AnalyticsController`
- **Routes:** `GET /analytics/revenue`, `GET /analytics/drivers`, `GET /analytics/fleet-utilization`, all scoped to the requesting owner's `companyId` and accepting a date-range query
- **Socket events:** none
- **Testing checklist:** every analytics query is provably scoped to the requesting company only (test with two companies' data present, verify no cross-contamination); date-range filtering is correct at boundary values.
- **Definition of Done:** an owner can pull revenue and fleet stats for a chosen date range, verified against manually-tallied expected numbers from seeded test data.

---

### Milestone 11 — Hardening & Deployment
**Objective:** Production-readiness pass — this is where "MVP that works" becomes "MVP you'd actually deploy."

- **Files to create/modify:** `eslint.config.js`, CI workflow (`.github/workflows/ci.yml`), rate limiter tuning on auth + job-creation endpoints, log review pass (no PII in logs), remove `bcryptjs` dependency, pin exact dependency versions
- **Testing checklist:** full regression pass across all prior milestones' test suites; load-test the nearby-driver query and job-creation endpoint at a realistic concurrent-user estimate; verify no secret ever appears in logs or error responses; confirm CORS is locked down for the production frontend URL, not `*`.
- **Definition of Done:** CI green on a clean clone + install, staging deployment reachable over HTTPS, and a short runbook (how to deploy, how to roll back, where logs live) written down somewhere other than someone's memory.

---

**This document is now the technical baseline.** Nothing above gets silently changed once we start Milestone 0 — if a milestone reveals that a decision here was wrong, we come back and amend this document explicitly, with the same "why/trade-off" treatment as the original decision, rather than drifting from it undocumented.

Waiting on: your call on Section 0 (models colocated vs. centralized — I've proceeded with centralized above), sign-off on the five additional models in 3.6, and the open question in 3.7 about vehicle-independent GPS. Once those three are settled, we start Milestone 0.
