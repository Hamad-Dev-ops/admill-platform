import { model, Schema } from "mongoose";
import { ServiceType } from "../constants/service.enum";
import { VehicleStatus, VehicleType } from "../constants/vehicle.enum";
import { IVehicle } from "../interfaces/vehicle.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const vehicleSchema = new Schema<IVehicle>(
  {
    vehicleCode: { type: String, required: true, unique: true },

    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    assignedDriver: { type: Schema.Types.ObjectId, ref: "Driver" },

    plateNumber: { type: String, required: true },
    registrationNumber: { type: String, required: true },
    chassisNumber: { type: String, required: true },

    vehicleType: { type: String, enum: Object.values(VehicleType), required: true },
    recoveryType: { type: [String], enum: Object.values(ServiceType), default: [] },

    currentStatus: { type: String, enum: Object.values(VehicleStatus), default: VehicleStatus.OFFLINE },

    insurancePolicyNumber: { type: String, required: true },
    insuranceExpiry: { type: Date, required: true },
    registrationExpiry: { type: Date, required: true },

    lastMaintenance: { type: Date },
    nextMaintenance: { type: Date },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const VehicleModel = model<IVehicle>("Vehicle", vehicleSchema);
