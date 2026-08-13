import { Types } from "mongoose";
import { IPricingConfig } from "../interfaces/pricingConfig.interface";
import { PricingConfigModel } from "../models/pricingConfig.model";

type PricingConfigUpdatableFields = Partial<
  Pick<
    IPricingConfig,
    | "currentFuelPrice"
    | "fuelConsumptionPerKm"
    | "perKmRate"
    | "peakHourWindows"
    | "peakHourSurcharge"
    | "lowSupplyThreshold"
    | "maxDemandSurcharge"
    | "surgeEnabled"
  >
>;

type PricingConfigSnapshot = Pick<
  IPricingConfig,
  | "version"
  | "currentFuelPrice"
  | "fuelConsumptionPerKm"
  | "perKmRate"
  | "peakHourWindows"
  | "peakHourSurcharge"
  | "lowSupplyThreshold"
  | "maxDemandSurcharge"
  | "surgeEnabled"
> & { _id: Types.ObjectId };

export const PricingConfigRepository = {
  async findActiveOrCreateDefault() {
    const existing = await PricingConfigModel.findOne({ isActive: true, isDeleted: false });

    if (existing) {
      return existing;
    }

    return PricingConfigModel.create({
      version: 1,
      effectiveFrom: new Date(),
      isActive: true,
      currentFuelPrice: 2.5,
      fuelConsumptionPerKm: 0.12,
      perKmRate: 2,
      peakHourWindows: [
        { startHour: 7, endHour: 10 },
        { startHour: 17, endHour: 20 },
      ],
      peakHourSurcharge: 15,
      lowSupplyThreshold: 5,
      maxDemandSurcharge: 30,
      surgeEnabled: false,
    });
  },

  async findById(id: string | Types.ObjectId) {
    return PricingConfigModel.findOne({ _id: id, isDeleted: false });
  },

  async create(data: Omit<IPricingConfig, "_id" | "isActive" | "isDeleted" | "createdAt" | "updatedAt">) {
    return PricingConfigModel.create(data);
  },

  async deactivateById(id: string | Types.ObjectId, effectiveTo: Date) {
    return PricingConfigModel.findOneAndUpdate({ _id: id }, { isActive: false, effectiveTo }, { returnDocument: "after" });
  },

  /**
   * Mechanical "deactivate old, create new" persistence — used by both the admin
   * update path (PricingConfigService) and the automatic external fuel-price sync
   * path (ConfigFuelPriceProvider), so this transition logic exists in exactly one
   * place regardless of what triggered the change.
   */
  async createNewVersionFrom(current: PricingConfigSnapshot, updates: PricingConfigUpdatableFields) {
    const now = new Date();

    await this.deactivateById(current._id, now);

    return this.create({
      version: current.version + 1,
      effectiveFrom: now,
      currentFuelPrice: updates.currentFuelPrice ?? current.currentFuelPrice,
      fuelConsumptionPerKm: updates.fuelConsumptionPerKm ?? current.fuelConsumptionPerKm,
      perKmRate: updates.perKmRate ?? current.perKmRate,
      peakHourWindows: updates.peakHourWindows ?? current.peakHourWindows,
      peakHourSurcharge: updates.peakHourSurcharge ?? current.peakHourSurcharge,
      lowSupplyThreshold: updates.lowSupplyThreshold ?? current.lowSupplyThreshold,
      maxDemandSurcharge: updates.maxDemandSurcharge ?? current.maxDemandSurcharge,
      surgeEnabled: updates.surgeEnabled ?? current.surgeEnabled,
    });
  },
};
