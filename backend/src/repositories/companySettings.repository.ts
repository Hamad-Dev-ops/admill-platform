import { Types } from "mongoose";
import { ICompanySettings } from "../interfaces/companySettings.interface";
import { CompanySettingsModel } from "../models/companySettings.model";

// Nested settings fields (e.g. operatingHours.open) can be updated independently of
// their siblings, so the update payload needs every level optional, not just the top one.
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/**
 * Mongoose's default $set on a nested object field (e.g. `operatingHours`) replaces
 * the whole subdocument, silently dropping sibling keys on a partial update — patching
 * just `operatingHours.open` would otherwise wipe `operatingHours.close`. Flattening to
 * dot-notation makes each leaf field its own $set target, giving correct partial-merge
 * semantics for nested settings.
 */
function flattenForUpdate(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(acc, flattenForUpdate(value as Record<string, unknown>, path));
      } else {
        acc[path] = value;
      }

      return acc;
    },
    {} as Record<string, unknown>
  );
}

export const CompanySettingsRepository = {
  async create(companyId: Types.ObjectId) {
    return CompanySettingsModel.create({ companyId });
  },

  async findByCompanyId(companyId: string | Types.ObjectId) {
    return CompanySettingsModel.findOne({ companyId, isDeleted: false });
  },

  async updateByCompanyId(companyId: string | Types.ObjectId, data: DeepPartial<ICompanySettings>) {
    return CompanySettingsModel.findOneAndUpdate(
      { companyId, isDeleted: false },
      { $set: flattenForUpdate(data as Record<string, unknown>) },
      { returnDocument: "after" }
    );
  },
};
