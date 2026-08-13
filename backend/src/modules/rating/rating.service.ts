import { Types } from "mongoose";
import { JobStatus } from "../../constants/job.enum";
import { AppError } from "../../errors/AppError";
import { CustomerRepository } from "../../repositories/customer.repository";
import { DriverRepository } from "../../repositories/driver.repository";
import { JobRepository } from "../../repositories/job.repository";
import { RatingRepository } from "../../repositories/rating.repository";
import { CreateRatingInput } from "./rating.validator";

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export const RatingService = {
  // POST /jobs/:id/rating — customer-only (route-level requireRole), only on a
  // COMPLETED job, only by that job's own customer, only once.
  async create(customerUserId: string, jobId: string, input: CreateRatingInput) {
    const job = await JobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, "Job not found");
    }

    if (job.status !== JobStatus.COMPLETED) {
      throw new AppError(409, "Only a completed job can be rated");
    }

    const customer = await CustomerRepository.findByUserId(customerUserId);
    if (!customer?._id || !customer._id.equals(job.customerId)) {
      throw new AppError(403, "You do not have permission to rate this job");
    }

    // A COMPLETED job always has an assigned driver (the state machine requires
    // ACCEPTED before COMPLETED is reachable) — checked anyway since IJob.driverId is
    // typed optional.
    if (!job.driverId) {
      throw new AppError(409, "This job has no assigned driver to rate");
    }

    const existing = await RatingRepository.findByJobId(jobId);
    if (existing) {
      throw new AppError(409, "This job has already been rated");
    }

    let rating;
    try {
      rating = await RatingRepository.create({
        jobId: job._id!,
        customerId: customer._id!,
        driverId: job.driverId,
        stars: input.stars,
        review: input.review,
      });
    } catch (err) {
      // Race-safety backstop: the unique index on jobId (models/rating.model.ts)
      // rejects a second concurrent insert even if the pre-check above raced with
      // another request — translated to the same 409 a sequential duplicate gets.
      if (isDuplicateKeyError(err)) {
        throw new AppError(409, "This job has already been rated");
      }

      throw err;
    }

    const { average, count } = await RatingRepository.getDriverAggregate(job.driverId);
    await DriverRepository.updateById(job.driverId, { rating: average, totalTrips: count });

    return rating;
  },

  async listForDriver(driverId: string | Types.ObjectId, pagination: { skip: number; limit: number }) {
    return RatingRepository.findManyByDriver(driverId, pagination);
  },
};
