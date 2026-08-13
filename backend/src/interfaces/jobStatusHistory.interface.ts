import { Types } from "mongoose";
import { JobStatus } from "../constants/job.enum";
import { IBase } from "./base.interface";

export interface IJobStatusHistory extends IBase {
  jobId: Types.ObjectId;
  status: JobStatus;
  changedBy: Types.ObjectId; // User._id of whoever caused the transition
  note?: string;
}
