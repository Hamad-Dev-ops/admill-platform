import { IUser } from "../interfaces/user.interface";
import { UserModel } from "../models/user.model";

export const UserRepository = {
  async create(data: Pick<IUser, "firstName" | "lastName" | "email" | "phone" | "password" | "role">) {
    return UserModel.create(data);
  },

  async findById(id: string) {
    return UserModel.findOne({ _id: id, isDeleted: false });
  },

  async findByEmailWithPassword(email: string) {
    return UserModel.findOne({ email: email.toLowerCase(), isDeleted: false }).select("+password");
  },

  async findByEmailOrPhone(email: string, phone: string) {
    return UserModel.findOne({
      isDeleted: false,
      $or: [{ email: email.toLowerCase() }, { phone }],
    });
  },

  async updateLastLogin(id: string) {
    return UserModel.findByIdAndUpdate(id, { lastLogin: new Date() });
  },
};
