import { model, Schema } from "mongoose";
import { ServiceType } from "../constants/service.enum";
import { IFareCalculation } from "../interfaces/fareCalculation.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const fareCalculationSchema = new Schema<IFareCalculation>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, unique: true, index: true },
    serviceType: { type: String, enum: Object.values(ServiceType), required: true },
    distanceKm: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    factors: [
      {
        _id: false,
        name: { type: String, required: true },
        amount: { type: Number, required: true },
        description: { type: String, required: true },
      },
    ],
    total: { type: Number, required: true },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const FareCalculationModel = model<IFareCalculation>("FareCalculation", fareCalculationSchema);
