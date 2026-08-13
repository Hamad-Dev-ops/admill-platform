import { model, Schema } from "mongoose";
import { ICompanySettings } from "../interfaces/companySettings.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const companySettingsSchema = new Schema<ICompanySettings>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },

    operatingHours: {
      open: { type: String, default: "08:00" },
      close: { type: String, default: "20:00" },
    },

    defaultServiceRadiusKm: { type: Number, default: 15 },

    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },

    invoiceBranding: {
      logoUrl: { type: String },
      invoicePrefix: { type: String, default: "INV" },
    },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const CompanySettingsModel = model<ICompanySettings>("CompanySettings", companySettingsSchema);
