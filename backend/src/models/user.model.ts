import { model, Schema } from "mongoose";
import { UserRole } from "../constants/role.enum";
import { IUser } from "../interfaces/user.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },

    password: { type: String, required: true, select: false },

    role: { type: String, enum: Object.values(UserRole), required: true },

    profileImage: { type: String },

    lastLogin: { type: Date },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const UserModel = model<IUser>("User", userSchema);
