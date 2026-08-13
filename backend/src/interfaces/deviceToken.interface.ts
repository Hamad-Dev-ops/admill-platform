import { Types } from "mongoose";
import { DevicePlatform } from "../constants/device.enum";
import { IBase } from "./base.interface";

export interface IDeviceToken extends IBase {
  userId: Types.ObjectId;

  fcmToken: string;

  platform: DevicePlatform;

  lastUsedAt: Date;
}
