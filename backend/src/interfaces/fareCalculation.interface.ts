import { Types } from "mongoose";
import { ServiceType } from "../constants/service.enum";
import { IBase } from "./base.interface";

export interface IFareCalculationFactor {
  name: string;
  amount: number;
  description: string;
}

export interface IFareCalculation extends IBase {
  jobId: Types.ObjectId;
  serviceType: ServiceType;
  distanceKm: number;
  durationMinutes: number;
  factors: IFareCalculationFactor[];
  total: number;
}
