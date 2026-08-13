import { model, Schema } from "mongoose";
import { IRating } from "../interfaces/rating.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const ratingSchema = new Schema<IRating>(
  {
    // Unique, not just indexed: a job can be rated at most once — the DB-level
    // backstop for the "only once" acceptance criterion, alongside the service-layer
    // pre-check (same defense-in-depth shape as Company.ownerId's uniqueness).
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, unique: true },

    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },

    stars: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, maxlength: 500 },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const RatingModel = model<IRating>("Rating", ratingSchema);
