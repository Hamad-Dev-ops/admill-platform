# Admill Vehicle Recovery — Backend

Roadside assistance / vehicle recovery dispatch platform (UAE), internship project at TezAds, intended for real commercial deployment. Same shape as Uber/Careem but dispatching recovery vehicles instead of passenger rides. Three independent roles: Customer, Driver, Business Owner.

**Architecture and roadmap are frozen.** The full rationale, all "why/trade-off" reasoning, and the milestone-by-milestone plan live in `/docs/architecture-baseline.md` — treat that file as ground truth for *why* things are structured this way. This file is the condensed, load-every-session version for *how* to work day to day. If the two ever conflict, `architecture-baseline.md` wins and this file is stale and needs updating.

## Non-negotiable process rules

- **One milestone at a time**, in the order listed below. Do not start Milestone N+1 until Milestone N's Definition of Done is met and I've explicitly confirmed it.
- **Do not silently deviate from an architectural decision below.** If you think a decision is wrong once you're implementing it, stop and tell me why, with trade-offs — don't just implement something different.
- **No business logic in controllers or repositories.** Controllers: parse request → call one service method → return via `ApiResponse`. Repositories: Mongoose queries only. All business rules live in services.
- **No hard deletes.** Every model uses the existing soft-delete pattern (`isActive`, `isDeleted` from `IBase` / `softDeleteDefinition`).
- **Strict TypeScript.** No `any` on Express handlers or anywhere else without a specific, commented reason. `tsconfig.json` already has `strict: true` — respect it, don't work around it.
- **Errors are thrown, not returned.** Use `AppError(statusCode, message)` from `common/errors`. Never hand-roll an error response shape in a controller.
- After finishing a milestone: run `tsc --noEmit` and `eslint`, list what you built against that milestone's testing checklist, and tell me explicitly what's left before I sign off — don't declare a milestone done unilaterally.

## Tech stack

Node.js, Express 5, TypeScript (strict), MongoDB Atlas via Mongoose, JWT (access + refresh) auth, bcrypt, Zod validation, Socket.IO, Cloudinary (file storage), Firebase Cloud Messaging (push), multer (upload parsing). No Redis in V1 — see Tracking section below for why and how it's kept swappable.

## Folder structure (already scaffolded — fill in, don't restructure)

```
admill-backend/
├── server.ts                    # entrypoint
├── src/
│   ├── app.ts
│   ├── config/                  # env.ts, database.ts, socket.ts, cloudinary.ts, firebase.ts
│   ├── common/                  # cross-cutting, shared by every module
│   │   ├── constants/           # enums — already written, don't touch without reason
│   │   ├── interfaces/          # shared TS interfaces
│   │   ├── errors/AppError.ts
│   │   ├── middlewares/         # auth, rbac, validate, error, rateLimiter, requestLogger
│   │   ├── responses/ApiResponse.ts
│   │   ├── utils/                # bcrypt, jwt, logger, geo, pagination, schema/*
│   │   └── types/                 # express.d.ts, global.d.ts
│   ├── models/                    # ALL Mongoose schemas live here (centralized — see note below)
│   ├── repositories/              # one file per model, thin data access only
│   └── modules/                   # feature modules — business logic organized by domain
│       ├── auth/  company/  customer/  driver/  vehicle/  job/
│       ├── tracking/   (service + socket handler)
│       ├── pricing/     (service + factors/ subfolder, one file per pricing factor)
│       ├── notification/  document/  rating/  analytics/
├── routes/v1/index.ts             # mounts every module's router
├── socket/index.ts                # mounts every module's socket namespace
└── tests/{unit,integration,fixtures}/
```

**Why models are centralized, not inside each module:** Job/Driver/Vehicle/Customer/Company reference each other constantly. Colocating models per module invites circular imports across module boundaries. Modules own *behavior* (controller/service/routes/validators); `models/` is the one shared data layer everyone imports from. Don't move a model into a module folder to "complete" the module pattern — that was a deliberate call, not an oversight.

## Key architectural decisions (frozen — implement these, don't redesign them)

1. **Identity lives only on `User`** (firstName, lastName, email, phone, password, role). `Customer`/`Driver` hold only role-specific fields + `userId` reference. Never duplicate name/email/phone onto a role document. Populate from `User` when needed.
2. **No separate `Owner` collection.** Business Owner = `User` with `role: OWNER`. `Company.ownerId → User._id`.
3. **All location fields are GeoJSON**, never raw lat/lng: `{ type: "Point", coordinates: [lng, lat] }` with a `2dsphere` index. Applies to `Driver.currentLocation`, `Customer.currentLocation`, `Job.pickupLocation.geo`, `Job.destinationLocation.geo`, `LocationHistory.location`. Keep `address: string` as a separate plain field alongside `geo` — both are needed, one for querying, one for display.
4. **Tracking = Mongo-only in V1, behind an interface.** `TrackingService` depends on `ITrackingStore` (`updateDriverPosition`, `getDriverPosition`, `findNearbyDrivers`). V1 implementation is `MongoTrackingStore`: driver position is a **mutated field** on `Driver.currentLocation` (upsert-in-place), never a new document per GPS ping. Sampled writes only (e.g. every 15–30s while a job is active) go to `LocationHistory` for trip playback/audit. Nothing outside `TrackingService` ever touches the storage mechanism directly — that's the seam that lets a future `RedisTrackingStore` swap in with a one-line change.
5. **Pricing engine is a strategy list**, not a monolith function. `PricingService` holds an array of `IPricingFactor` (BaseFare, Distance, FuelPrice, RushHour, Weather, and later Surge), each independently testable. `JobService` calls `pricingService.calculateFare(context)` and never changes when a factor is added/removed. Fuel price / rush-hour windows / per-service base fares are read from the `PricingConfig` model — never hardcoded.
6. **Auth: JWT access (short-lived, ~15min) + refresh token (rotated on use, revocable).** Refresh tokens are stored **hashed** in a `RefreshToken` collection (one doc per active session/device), not as a single field on `User` — this is what makes "log out this device" / "log out everywhere" possible.
7. **Standard API response envelope everywhere:**
   - success: `{ success: true, data, message?, meta? }`
   - error (from the global error middleware only): `{ success: false, message, errors? }`
   Never construct these by hand in a controller — use `ApiResponse`.
8. **API versioned from day one**: everything under `/api/v1/*`. Once a mobile build depends on v1, v1 is never changed in a breaking way.
9. **Business-readable IDs** (`CMP-000001`, `JOB-20260731-000001`) via `generateBusinessId`, sourced from an atomic `Counter` collection (`findOneAndUpdate` + `$inc`) — never `countDocuments() + 1`, which races under concurrent writes.
10. **Documents are polymorphic**: one `Document` model with `ownerType` (DRIVER/VEHICLE/COMPANY) + `ownerId`, not separate collections per owner type — gives the Business Owner one approval queue across everything.

## Models (complete list — see architecture-baseline.md §3.6 for why each was added)

`User`, `Company`, `CompanySettings`, `Customer`, `Driver`, `Vehicle`, `Service`, `Job`, `JobStatusHistory`, `FareCalculation`, `Rating`, `Notification`, `Document`, `DeviceToken`, `RefreshToken`, `PricingConfig`, `LocationHistory`, `Counter`.

## Milestone roadmap (build in this order)

0. Environment & Foundation — config validation, DB connection, error handling, response envelope, logger, health check
1. Auth & Identity — register/login/refresh/logout all 3 roles, RBAC middleware
2. Company & Settings — company profile, CompanySettings, Counter-based companyCode
3. Driver, Vehicle & Document Management — onboarding, document upload/approval, vehicle assignment
4. Customer Module — registration, profile
5. Service Catalog & Pricing Engine — configurable services, PricingConfig, fare-estimate endpoint (no job yet)
6. Job Lifecycle & Dispatch — request → nearby drivers (2dsphere query) → accept → status progression, JobStatusHistory, FareCalculation persisted per job
7. Real-Time Tracking — Socket.IO driver location flow per decision #4 above
8. Notifications — Notification + DeviceToken models, FCM push, in-app socket delivery
9. Ratings & Job Completion — Rating model, driver aggregate rating recompute
10. Analytics & Reporting — revenue/driver/fleet queries, scoped per company
11. Hardening & Deployment — lint config, CI, rate limiting review, dependency pinning, secrets audit

Full per-milestone breakdown (files to create/modify, models/services/controllers/routes/socket events involved, testing checklist, Definition of Done) is in `/docs/architecture-baseline.md` §23 — read the relevant section before starting each milestone rather than relying on the one-line summary above.

## Open items not yet decided (ask, don't assume)

- Does `Vehicle` ever track GPS independently of its assigned `Driver`, or is vehicle location always derived from driver location in V1? Affects how `LocationHistory` keys (`driverId`, `vehicleId`, or both). Ask before building Milestone 7 if this hasn't been answered yet.
