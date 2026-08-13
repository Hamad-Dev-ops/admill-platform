import { Types } from "mongoose";
import { ILocationHistory } from "../interfaces/locationHistory.interface";
import { LocationHistoryModel } from "../models/locationHistory.model";

export const LocationHistoryRepository = {
  async create(
    data: Pick<ILocationHistory, "driverId" | "jobId" | "location" | "timestamp" | "speed" | "heading" | "accuracy">
  ) {
    return LocationHistoryModel.create(data);
  },

  // Chronological order — trip playback (the feature this table exists to support)
  // reads a job's samples start to finish, same sort direction JobStatusHistory uses.
  async findByJobId(jobId: string | Types.ObjectId) {
    return LocationHistoryModel.find({ jobId, isDeleted: false }).sort({ timestamp: 1 });
  },
};
