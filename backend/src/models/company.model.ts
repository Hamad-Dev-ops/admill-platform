import { model, Schema } from "mongoose";
import { ICompany } from "../interfaces/company.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const companySchema = new Schema<ICompany>(
  {
    companyCode: { type: String, required: true, unique: true },

    companyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    logo: { type: String },

    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },

    tradeLicenseNumber: { type: String, required: true },
    tradeLicenseExpiry: { type: Date, required: true },

    serviceAreas: { type: [String], default: [] },

    // Unique: enforces one-company-per-owner at the DB level too, not just in the service.
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const CompanyModel = model<ICompany>("Company", companySchema);
