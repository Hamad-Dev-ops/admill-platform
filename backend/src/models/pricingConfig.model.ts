import { model, Schema } from "mongoose";
import { IPricingConfig } from "../interfaces/pricingConfig.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const peakHourWindowSchema = new Schema(
  {
    startHour: { type: Number, required: true, min: 0, max: 23 },
    endHour: { type: Number, required: true, min: 0, max: 23 },
  },
  { _id: false }
);

const pricingConfigSchema = new Schema<IPricingConfig>(
  {
    version: { type: Number, required: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    isActive: { type: Boolean, required: true, default: true },

    currentFuelPrice: { type: Number, required: true },
    fuelConsumptionPerKm: { type: Number, required: true },
    perKmRate: { type: Number, required: true },

    peakHourWindows: { type: [peakHourWindowSchema], default: [] },
    peakHourSurcharge: { type: Number, required: true },

    lowSupplyThreshold: { type: Number, required: true },
    maxDemandSurcharge: { type: Number, required: true },

    surgeEnabled: { type: Boolean, default: false },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

// At most one active version at a time — enforced at the DB level (not just in the
// service's transition logic) so a race between two concurrent updates can't leave
// two documents both marked active.
pricingConfigSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export const PricingConfigModel = model<IPricingConfig>("PricingConfig", pricingConfigSchema);
