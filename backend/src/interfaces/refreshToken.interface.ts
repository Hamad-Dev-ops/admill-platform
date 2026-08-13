import { Types } from "mongoose";
import { IBase } from "./base.interface";

export interface IRefreshToken extends IBase {
  userId: Types.ObjectId;

  tokenHash: string;

  deviceInfo?: string;

  expiresAt: Date;

  revokedAt?: Date;
}
