import { model, Schema } from "mongoose";
import { DriverApprovalStatus, DriverStatus } from "../constants/driver.enum";
import { IDriver } from "../interfaces/driver.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const driverSchema = new Schema<IDriver>(
  {
    employeeId: { type: String, required: true, unique: true },

    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },

    nationalId: { type: String, required: true },
    emiratesId: { type: String, required: true },
    emiratesIdExpiry: { type: Date, required: true },

    drivingLicenseNumber: { type: String, required: true },
    drivingLicenseExpiry: { type: Date, required: true },

    profileImage: { type: String },

    status: { type: String, enum: Object.values(DriverStatus), default: DriverStatus.OFFLINE },

    approvalStatus: {
      type: String,
      enum: Object.values(DriverApprovalStatus),
      default: DriverApprovalStatus.PENDING_APPROVAL,
    },
    rejectionReason: { type: String },

    rating: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },

    currentLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

driverSchema.index({ currentLocation: "2dsphere" });

export const DriverModel = model<IDriver>("Driver", driverSchema);
