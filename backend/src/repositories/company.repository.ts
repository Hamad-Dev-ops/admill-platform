import { Types } from "mongoose";
import { ICompany } from "../interfaces/company.interface";
import { CompanyModel } from "../models/company.model";

export const CompanyRepository = {
  async create(data: Omit<ICompany, "_id" | "isActive" | "isDeleted" | "createdAt" | "updatedAt">) {
    return CompanyModel.create(data);
  },

  async findByOwnerId(ownerId: string | Types.ObjectId) {
    return CompanyModel.findOne({ ownerId, isDeleted: false });
  },

  async updateByOwnerId(ownerId: string | Types.ObjectId, data: Partial<ICompany>) {
    return CompanyModel.findOneAndUpdate({ ownerId, isDeleted: false }, data, { returnDocument: "after" });
  },

  async findByCompanyCode(companyCode: string) {
    return CompanyModel.findOne({ companyCode, isDeleted: false });
  },

  async findById(id: string | Types.ObjectId) {
    return CompanyModel.findOne({ _id: id, isDeleted: false });
  },
};
