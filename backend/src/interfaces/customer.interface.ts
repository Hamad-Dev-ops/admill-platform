import { Types } from "mongoose";
import { IBase } from "./base.interface";

export interface ICustomer extends IBase {
  customerCode: string;

  userId: Types.ObjectId;

  nationalId: string;

  address?: string;

  averageRating: number;

  totalJobs: number;
}