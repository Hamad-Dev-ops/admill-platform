import { IBase } from "./base.interface";
import { UserRole } from "../constants/role.enum";

export interface IUser extends IBase {
  firstName: string;
  lastName: string;

  email: string;
  phone: string;

  password: string;

  role: UserRole;

  profileImage?: string;

  lastLogin?: Date;
}