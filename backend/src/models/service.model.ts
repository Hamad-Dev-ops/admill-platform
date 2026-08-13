import { model, Schema } from "mongoose";
import { ServiceType } from "../constants/service.enum";
import { IService } from "../interfaces/service.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const serviceSchema = new Schema<IService>(
  {
    serviceCode: { type: String, required: true, unique: true },
    serviceType: { type: String, enum: Object.values(ServiceType), required: true, unique: true },

    displayName: { type: String, required: true },
    description: { type: String },

    baseFare: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const ServiceModel = model<IService>("Service", serviceSchema);
