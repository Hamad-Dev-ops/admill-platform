import { Types } from "mongoose";
import { IFareCalculation } from "../interfaces/fareCalculation.interface";
import { FareCalculationModel } from "../models/fareCalculation.model";

export const FareCalculationRepository = {
  async create(data: Omit<IFareCalculation, "_id" | "isActive" | "isDeleted" | "createdAt" | "updatedAt">) {
    return FareCalculationModel.create(data);
  },

  async findByJobId(jobId: string | Types.ObjectId) {
    return FareCalculationModel.findOne({ jobId, isDeleted: false });
  },
};
