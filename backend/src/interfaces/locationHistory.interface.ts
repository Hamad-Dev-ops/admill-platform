import { Types } from "mongoose";
import { IBase } from "./base.interface";
import { IGeoPoint } from "./geo.interface";

// Sampled GPS history for trip playback/audit (architecture-baseline §6). driverId is
// authoritative — vehicle location is derived from Driver.currentLocation in V1, not
// tracked independently (no Vehicle GPS subsystem). jobId ties each sample to the trip
// it was recorded during; a record only ever exists for a job that was EN_ROUTE/STARTED
// at sample time — see TrackingService, which owns that decision, not this interface.
export interface ILocationHistory extends IBase {
  driverId: Types.ObjectId;
  jobId: Types.ObjectId;
  location: IGeoPoint;
  timestamp: Date;
  speed?: number;
  heading?: number;
  accuracy?: number;
}
