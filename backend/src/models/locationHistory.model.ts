import { model, Schema } from "mongoose";
import { ILocationHistory } from "../interfaces/locationHistory.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const locationHistorySchema = new Schema<ILocationHistory>(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },

    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
    },

    timestamp: { type: Date, required: true, default: Date.now },
    speed: { type: Number },
    heading: { type: Number },
    accuracy: { type: Number },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

locationHistorySchema.index({ location: "2dsphere" });
locationHistorySchema.index({ driverId: 1, timestamp: -1 });
locationHistorySchema.index({ jobId: 1, timestamp: 1 });

export const LocationHistoryModel = model<ILocationHistory>("LocationHistory", locationHistorySchema);
