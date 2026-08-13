import { Types } from "mongoose";
import { ServiceType } from "../constants/service.enum";
import { IService } from "../interfaces/service.interface";
import { ServiceModel } from "../models/service.model";

export const ServiceRepository = {
  async create(data: Pick<IService, "serviceCode" | "serviceType" | "displayName" | "description" | "baseFare">) {
    return ServiceModel.create(data);
  },

  async findAll() {
    return ServiceModel.find({ isDeleted: false });
  },

  async findByType(serviceType: ServiceType) {
    return ServiceModel.findOne({ serviceType, isDeleted: false });
  },

  async findById(id: string | Types.ObjectId) {
    return ServiceModel.findOne({ _id: id, isDeleted: false });
  },
};
