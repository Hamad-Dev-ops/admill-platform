import { Types } from "mongoose";
import { IBase } from "./base.interface";

export interface ICompany extends IBase {
  companyCode: string;

  companyName: string;

  email: string;

  phone: string;

  logo?: string;

  address: string;

  city: string;

  country: string;

  tradeLicenseNumber: string;

  tradeLicenseExpiry: Date;

  serviceAreas: string[];

  ownerId: Types.ObjectId;
}