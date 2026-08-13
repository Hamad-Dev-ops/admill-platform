import { Types } from "mongoose";
import { IBase } from "./base.interface";
import { VehicleStatus, VehicleType } from "../constants/vehicle.enum";
import { ServiceType } from "../constants/service.enum";

export interface IVehicle extends IBase {
  vehicleCode: string;

  companyId: Types.ObjectId;

  assignedDriver?: Types.ObjectId;

  plateNumber: string;

  registrationNumber: string;

  chassisNumber: string;

  vehicleType: VehicleType;

  recoveryType: ServiceType[];

  currentStatus: VehicleStatus;

  insurancePolicyNumber: string;

  insuranceExpiry: Date;

  registrationExpiry: Date;

  lastMaintenance?: Date;

  nextMaintenance?: Date;
}