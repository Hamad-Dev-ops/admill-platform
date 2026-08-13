import { Types } from "mongoose";
import { JobStatus } from "../constants/job.enum";
import { JobStatusHistoryModel } from "../models/jobStatusHistory.model";

export const JobStatusHistoryRepository = {
  async create(jobId: Types.ObjectId, status: JobStatus, changedBy: Types.ObjectId, note?: string) {
    return JobStatusHistoryModel.create({ jobId, status, changedBy, note });
  },

  async findByJobId(jobId: string | Types.ObjectId) {
    return JobStatusHistoryModel.find({ jobId, isDeleted: false }).sort({ createdAt: 1 });
  },
};
