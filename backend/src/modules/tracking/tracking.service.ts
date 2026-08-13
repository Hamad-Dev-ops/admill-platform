import { Types } from "mongoose";
import { UserRole } from "../../constants/role.enum";
import { AppError } from "../../errors/AppError";
import { cacheProvider } from "../../infrastructure/cache/inMemoryCache.provider";
import { IDriver } from "../../interfaces/driver.interface";
import { IGeoPoint } from "../../interfaces/geo.interface";
import { CustomerRepository } from "../../repositories/customer.repository";
import { DriverRepository } from "../../repositories/driver.repository";
import { JobRepository } from "../../repositories/job.repository";
import { LocationHistoryRepository } from "../../repositories/locationHistory.repository";
import { CompanyService } from "../company/company.service";
import { IDriverPositionMeta } from "./tracking.store.interface";
import { trackingStore } from "./mongoTracking.store";

// Sampling window: rapid GPS pings (~3-5s) always mutate Driver.currentLocation, but
// LocationHistory is written far less often — the baseline's stated 15-30s window,
// picked at the midpoint. A meaningful heading change can also trigger an earlier
// sample (architecture-baseline §6's "or on meaningful heading change"), gated through
// the same cache entry rather than a second mechanism.
const SAMPLE_INTERVAL_MS = 20_000;
const HEADING_CHANGE_THRESHOLD_DEGREES = 30;

interface ISampleCacheEntry {
  heading?: number;
}

// Exported so integration tests can deterministically clear the sampling gate
// (cacheProvider.delete(sampleCacheKey(driverId))) instead of waiting on real time —
// the same "reach into internal state to simulate time passing" approach
// tests/integration/job.test.ts already uses for Job.expiresAt.
export function sampleCacheKey(driverId: Types.ObjectId): string {
  return `tracking:lastSample:${driverId.toString()}`;
}

function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Reuses the existing ICacheProvider (get/set/delete + TTL) exactly as
// infrastructure/providers/fuelPrice/config.provider.ts and openWeatherMap.provider.ts
// already do — no new caching/rate-limit utility. The cache entry doubles as both the
// "has the interval elapsed" gate (TTL expiry = yes) and, while it's still live, the
// last-sampled heading for the early-trigger check.
async function maybeSampleLocationHistory(
  driverId: Types.ObjectId,
  jobId: Types.ObjectId,
  point: IGeoPoint,
  meta: IDriverPositionMeta
): Promise<boolean> {
  const key = sampleCacheKey(driverId);
  const cached = await cacheProvider.get<ISampleCacheEntry>(key);

  const intervalElapsed = !cached;
  const headingChanged =
    Boolean(cached) &&
    meta.heading !== undefined &&
    cached?.heading !== undefined &&
    angularDifference(meta.heading, cached.heading) >= HEADING_CHANGE_THRESHOLD_DEGREES;

  if (!intervalElapsed && !headingChanged) {
    return false;
  }

  await LocationHistoryRepository.create({
    driverId,
    jobId,
    location: point,
    timestamp: meta.timestamp ?? new Date(),
    speed: meta.speed,
    heading: meta.heading,
    accuracy: meta.accuracy,
  });

  await cacheProvider.set(key, { heading: meta.heading }, SAMPLE_INTERVAL_MS);
  return true;
}

export interface IPositionUpdateResult {
  driver: IDriver;
  activeJobId?: Types.ObjectId;
  sampled: boolean;
}

export interface IDriverLocationResult {
  driverId: Types.ObjectId;
  location: IGeoPoint | null;
}

// GET /drivers/:id/location authorization (Milestone 7 Decision 5) — mirrors
// modules/driver/driver.service.ts's assertDriverAccess (self-or-owning-company)
// exactly for the DRIVER/OWNER cases, extended with the one case that's specific to
// location viewing: a CUSTOMER may see this driver's position only while that driver
// is actively working that customer's own job. "Active" reuses the exact same
// EN_ROUTE/STARTED definition Decision 2 already established for LocationHistory
// sampling, rather than inventing a second definition of "active job."
async function assertCanViewDriverLocation(
  requesterId: string,
  requesterRole: UserRole,
  driver: Pick<IDriver, "userId" | "companyId" | "_id">
): Promise<void> {
  if (requesterRole === UserRole.DRIVER && driver.userId.toString() === requesterId) {
    return;
  }

  if (requesterRole === UserRole.OWNER) {
    await CompanyService.assertOwnerOwnsCompany(requesterId, driver.companyId);
    return;
  }

  if (requesterRole === UserRole.CUSTOMER) {
    const customer = await CustomerRepository.findByUserId(requesterId);
    const activeJob = customer ? await JobRepository.findActiveByDriverId(driver._id!) : null;

    if (customer?._id && activeJob?.customerId && customer._id.equals(activeJob.customerId)) {
      return;
    }
  }

  throw new AppError(403, "You do not have permission to access this driver's location");
}

export const TrackingService = {
  // Single entry point for both the REST fallback (PATCH /drivers/me/location) and the
  // Socket.IO path (driver:location:update) — see architecture decision to keep both
  // callers on one business-logic path, not two. `userId` must always be the
  // authenticated caller's own id (req.user.id / socket.user.id), never a value
  // supplied in the request body.
  async updateLocation(userId: string, point: IGeoPoint, meta: IDriverPositionMeta = {}): Promise<IPositionUpdateResult> {
    const driver = await trackingStore.updateDriverPosition(userId, point, meta);

    if (!driver) {
      throw new AppError(404, "Driver profile not found");
    }

    const activeJob = await JobRepository.findActiveByDriverId(driver._id!);
    const sampled = activeJob ? await maybeSampleLocationHistory(driver._id!, activeJob._id!, point, meta) : false;

    return { driver, activeJobId: activeJob?._id, sampled };
  },

  // Baseline-required fallback/debug endpoint (GET /drivers/:id/location). Never
  // exposes an arbitrary driver's location — see assertCanViewDriverLocation above.
  async getDriverLocation(requesterId: string, requesterRole: UserRole, driverId: string): Promise<IDriverLocationResult> {
    const driver = await DriverRepository.findById(driverId);

    if (!driver) {
      throw new AppError(404, "Driver not found");
    }

    await assertCanViewDriverLocation(requesterId, requesterRole, driver);

    return { driverId: driver._id!, location: driver.currentLocation ?? null };
  },
};
