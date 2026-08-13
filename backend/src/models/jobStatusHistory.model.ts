import { model, Schema } from "mongoose";
import { JobStatus } from "../constants/job.enum";
import { IJobStatusHistory } from "../interfaces/jobStatusHistory.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const jobStatusHistorySchema = new Schema<IJobStatusHistory>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    status: { type: String, enum: Object.values(JobStatus), required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const JobStatusHistoryModel = model<IJobStatusHistory>("JobStatusHistory", jobStatusHistorySchema);
