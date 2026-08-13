import { Types } from "mongoose";
import { IRating } from "../interfaces/rating.interface";
import { RatingModel } from "../models/rating.model";

export const RatingRepository = {
  async create(data: Pick<IRating, "jobId" | "customerId" | "driverId" | "stars" | "review">) {
    return RatingModel.create(data);
  },

  async findByJobId(jobId: string | Types.ObjectId) {
    return RatingModel.findOne({ jobId, isDeleted: false });
  },

  async findManyByDriver(driverId: string | Types.ObjectId, pagination: { skip: number; limit: number }) {
    const query = { driverId, isDeleted: false };

    const [data, total] = await Promise.all([
      RatingModel.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
      RatingModel.countDocuments(query),
    ]);

    return { data, total };
  },

  // Backs the driver aggregate recompute (RatingService.create) — a single indexed
  // aggregation query rather than pulling every rating into memory to average by hand.
  async getDriverAggregate(driverId: string | Types.ObjectId): Promise<{ average: number; count: number }> {
    const [result] = await RatingModel.aggregate<{ average: number; count: number }>([
      { $match: { driverId: new Types.ObjectId(driverId), isDeleted: false } },
      { $group: { _id: null, average: { $avg: "$stars" }, count: { $sum: 1 } } },
    ]);

    return result ?? { average: 0, count: 0 };
  },
};
