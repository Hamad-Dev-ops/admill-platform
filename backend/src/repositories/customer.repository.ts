import { Types } from "mongoose";
import { ICustomer } from "../interfaces/customer.interface";
import { CustomerModel } from "../models/customer.model";

const IDENTITY_FIELDS = "firstName lastName email phone profileImage";

export const CustomerRepository = {
  async create(data: Pick<ICustomer, "customerCode" | "userId" | "nationalId" | "address">) {
    return CustomerModel.create(data);
  },

  async findById(id: string | Types.ObjectId) {
    return CustomerModel.findOne({ _id: id, isDeleted: false });
  },

  // Decision #4/§3.3: identity lives only on User — any endpoint returning a customer
  // profile populates it from there rather than duplicating name/email/phone here.
  async findByIdWithIdentity(id: string | Types.ObjectId) {
    return CustomerModel.findOne({ _id: id, isDeleted: false }).populate("userId", IDENTITY_FIELDS);
  },

  async findByUserId(userId: string | Types.ObjectId) {
    return CustomerModel.findOne({ userId, isDeleted: false });
  },

  async updateById(id: string | Types.ObjectId, data: Partial<ICustomer>) {
    return CustomerModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, { returnDocument: "after" });
  },
};
