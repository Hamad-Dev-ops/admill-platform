import { Types } from "mongoose";
import { IBase } from "./base.interface";

export interface IOperatingHours {
  open: string;
  close: string;
}

export interface INotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface IInvoiceBranding {
  logoUrl?: string;
  invoicePrefix?: string;
}

export interface ICompanySettings extends IBase {
  companyId: Types.ObjectId;

  operatingHours: IOperatingHours;

  defaultServiceRadiusKm: number;

  notificationPreferences: INotificationPreferences;

  invoiceBranding: IInvoiceBranding;
}
