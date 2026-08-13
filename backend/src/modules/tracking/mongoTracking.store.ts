import { IDriver } from "../../interfaces/driver.interface";
import { IGeoPoint } from "../../interfaces/geo.interface";
import { DriverRepository } from "../../repositories/driver.repository";
import { IDriverPositionMeta, ITrackingStore } from "./tracking.store.interface";

// V1 implementation (architecture-baseline §6). Reuses DriverRepository's existing
// userId-keyed, in-place update (built for the M6 REST self-service endpoint) rather
// than adding a second driverId-keyed update path — one atomic findOneAndUpdate per
// ping, never a new document. `meta` (speed/heading/accuracy/timestamp) isn't
// persisted on Driver itself; TrackingService reads it to decide LocationHistory
// sampling, which is outside this store's concern.
export class MongoTrackingStore implements ITrackingStore {
  async updateDriverPosition(userId: string, point: IGeoPoint, _meta: IDriverPositionMeta): Promise<IDriver | null> {
    return DriverRepository.updateLocationByUserId(userId, point);
  }
}

// Single process-wide instance — swapping to Redis later is a one-line change here,
// the same pattern infrastructure/cache/inMemoryCache.provider.ts already uses.
export const trackingStore: ITrackingStore = new MongoTrackingStore();
