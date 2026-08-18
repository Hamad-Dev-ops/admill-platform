import { Types } from "mongoose";
import { JobStatus } from "../constants/job.enum";
import { IJob } from "../interfaces/job.interface";
import { JobModel } from "../models/job.model";
import { omitUndefined } from "../utils/object";

export const JobRepository = {
  async create(data: Omit<IJob, "_id" | "isActive" | "isDeleted" | "createdAt" | "updatedAt">) {
    return JobModel.create(data);
  },

  async findById(id: string | Types.ObjectId) {
    return JobModel.findOne({ _id: id, isDeleted: false });
  },

  // Atomic accept: the filter re-checks status: PENDING (and not yet expired) at the DB
  // level, so of two simultaneous accept calls on the same job only one findOneAndUpdate
  // can match and return a document — the loser gets null back, never a partial/duplicate
  // accept. Who is *allowed* to accept (offeredDriverIds membership, driver.status) is
  // checked in the service layer before this is ever called — this filter is purely the
  // race-safety mechanism, not the authorization check.
  async acceptIfPending(
    id: string | Types.ObjectId,
    driverId: Types.ObjectId,
    vehicleId: Types.ObjectId | undefined,
    acceptedAt: Date
  ) {
    return JobModel.findOneAndUpdate(
      { _id: id, isDeleted: false, status: JobStatus.PENDING, expiresAt: { $gt: acceptedAt } },
      { status: JobStatus.ACCEPTED, driverId, vehicleId, acceptedAt },
      { returnDocument: "after" }
    );
  },

  // Lazy expiration: no separate cron/scheduler in M6 — a PENDING job past its
  // expiresAt is flipped to EXPIRED the next time it's read or an accept is attempted.
  // Atomic for the same reason acceptIfPending is: filters on status: PENDING at the DB
  // level so it's safe to call opportunistically without a prior read-then-write race.
  async expireIfPast(id: string | Types.ObjectId, now: Date) {
    return JobModel.findOneAndUpdate(
      { _id: id, isDeleted: false, status: JobStatus.PENDING, expiresAt: { $lte: now } },
      { status: JobStatus.EXPIRED },
      { returnDocument: "after" }
    );
  },

  async updateById(id: string | Types.ObjectId, data: Partial<IJob>) {
    return JobModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, { returnDocument: "after" });
  },

  // Tracking (M7): the one job, if any, this driver is currently progressing — the
  // only statuses LocationHistory sampling should ever fire for. At most one such job
  // can exist per driver (Driver.status becomes ON_JOB on accept, released only at
  // COMPLETED/CANCELLED), so findOne is correct, not an arbitrary pick among many.
  async findActiveByDriverId(driverId: string | Types.ObjectId) {
    return JobModel.findOne({
      driverId,
      isDeleted: false,
      status: { $in: [JobStatus.EN_ROUTE, JobStatus.STARTED] },
    });
  },

  async findAssignedInProgressByDriverId(driverId: string | Types.ObjectId) {
    return JobModel.findOne({
      driverId,
      isDeleted: false,
      status: { $in: [JobStatus.ACCEPTED, JobStatus.EN_ROUTE, JobStatus.ARRIVED, JobStatus.STARTED] },
    });
  },

  async findManyByCompany(
    companyId: string | Types.ObjectId,
    filter: { status?: JobStatus },
    pagination: { skip: number; limit: number }
  ) {
    const query = { companyId, isDeleted: false, ...omitUndefined(filter) };

    const [data, total] = await Promise.all([
      JobModel.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
      JobModel.countDocuments(query),
    ]);

    return { data, total };
  },

  async findManyByCustomer(
    customerId: string | Types.ObjectId,
    filter: { status?: JobStatus },
    pagination: { skip: number; limit: number }
  ) {
    const query = { customerId, isDeleted: false, ...omitUndefined(filter) };

    const [data, total] = await Promise.all([
      JobModel.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
      JobModel.countDocuments(query),
    ]);

    return { data, total };
  },

  async findManyByDriver(
    driverId: string | Types.ObjectId,
    filter: { status?: JobStatus },
    pagination: { skip: number; limit: number }
  ) {
    const query = { driverId, isDeleted: false, ...omitUndefined(filter) };

    const [data, total] = await Promise.all([
      JobModel.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
      JobModel.countDocuments(query),
    ]);

    return { data, total };
  },

  // Analytics (M10): company-scoped revenue over a date range, matched on
  // completedAt (when the job actually finished, not when it was created) — the
  // same field JobService.updateStatus sets at COMPLETED. finalFare, not
  // estimatedFare, since that's the actual completion-time fare (M6).
  async getRevenueSummary(companyId: string | Types.ObjectId, startDate: Date, endDate: Date) {
    const [result] = await JobModel.aggregate<{ totalRevenue: number; completedJobsCount: number; averageFare: number }>([
      {
        $match: {
          companyId: new Types.ObjectId(companyId),
          isDeleted: false,
          status: JobStatus.COMPLETED,
          completedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$finalFare" },
          completedJobsCount: { $sum: 1 },
          averageFare: { $avg: "$finalFare" },
        },
      },
    ]);

    return result ?? { totalRevenue: 0, completedJobsCount: 0, averageFare: 0 };
  },

  async getCompletedJobStatsByDriver(companyId: string | Types.ObjectId, startDate: Date, endDate: Date) {
    return JobModel.aggregate<{ _id: Types.ObjectId; completedJobsCount: number; revenue: number }>([
      {
        $match: {
          companyId: new Types.ObjectId(companyId),
          isDeleted: false,
          status: JobStatus.COMPLETED,
          completedAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: "$driverId", completedJobsCount: { $sum: 1 }, revenue: { $sum: "$finalFare" } } },
    ]);
  },

  async getCompletedJobStatsByVehicle(companyId: string | Types.ObjectId, startDate: Date, endDate: Date) {
    return JobModel.aggregate<{ _id: Types.ObjectId; completedJobsCount: number }>([
      {
        $match: {
          companyId: new Types.ObjectId(companyId),
          isDeleted: false,
          status: JobStatus.COMPLETED,
          vehicleId: { $exists: true },
          completedAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: "$vehicleId", completedJobsCount: { $sum: 1 } } },
    ]);
  },
};
