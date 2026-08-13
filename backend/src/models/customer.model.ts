import { model, Schema } from "mongoose";
import { ICustomer } from "../interfaces/customer.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const customerSchema = new Schema<ICustomer>(
  {
    customerCode: { type: String, required: true, unique: true },

    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    nationalId: { type: String, required: true },
    address: { type: String },

    averageRating: { type: Number, default: 0 },
    totalJobs: { type: Number, default: 0 },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const CustomerModel = model<ICustomer>("Customer", customerSchema);
