import { IDriver } from "../../interfaces/driver.interface";
import { IGeoPoint } from "../../interfaces/geo.interface";

export interface IDriverPositionMeta {
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp?: Date;
}

// Narrow on purpose (architecture-baseline §6) — TrackingService only ever calls this
// interface, never a concrete store, so a future RedisTrackingStore is a one-line swap
// (constructor injection / factory keyed off env — same seam infrastructure/cache's
// ICacheProvider already uses). Grows in a later Milestone 7 phase when the REST
// "last known location" fallback needs a read method — not added speculatively now.
export interface ITrackingStore {
  // Identity is always the authenticated User._id — never a client-supplied driverId
  // (see TrackingService, which owns resolving/authorizing the caller before this is
  // ever invoked). Mutates Driver.currentLocation in place — never a new document per
  // ping — and returns the updated driver so the caller has _id/companyId/
  // currentLocation from the same round trip. Null if no driver profile exists for
  // this user.
  updateDriverPosition(userId: string, point: IGeoPoint, meta: IDriverPositionMeta): Promise<IDriver | null>;
}
