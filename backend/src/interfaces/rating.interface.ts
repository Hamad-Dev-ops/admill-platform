import { Types } from "mongoose";
import { IBase } from "./base.interface";

export interface IRating extends IBase {
  jobId: Types.ObjectId;

  customerId: Types.ObjectId;

  driverId: Types.ObjectId;

  stars: number;

  review?: string;
}
