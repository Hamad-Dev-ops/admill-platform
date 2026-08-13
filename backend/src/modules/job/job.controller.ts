import { Request, Response } from "express";
import { JobStatus } from "../../constants/job.enum";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { resolvePagination } from "../../utils/pagination";
import { getParam } from "../../utils/request";
import { RatingService } from "../rating/rating.service";
import { JobService } from "./job.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user;
}

function parseStatusFilter(value: unknown): JobStatus | undefined {
  if (typeof value === "string" && (Object.values(JobStatus) as string[]).includes(value)) {
    return value as JobStatus;
  }

  return undefined;
}

export const JobController = {
  async create(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const job = await JobService.create(user.id, req.body);
    res.status(201).json(ApiResponse.success(job, "Job created"));
  },

  async accept(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const job = await JobService.accept(user.id, getParam(req, "id"));
    res.status(200).json(ApiResponse.success(job, "Job accepted"));
  },

  async reject(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const job = await JobService.reject(user.id, getParam(req, "id"));
    res.status(200).json(ApiResponse.success(job, "Job declined"));
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const job = await JobService.updateStatus(user.id, user.role, getParam(req, "id"), req.body);
    res.status(200).json(ApiResponse.success(job, "Job status updated"));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const job = await JobService.getById(user.id, user.role, getParam(req, "id"));
    res.status(200).json(ApiResponse.success(job));
  },

  async list(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const pagination = resolvePagination(req.query);
    const status = parseStatusFilter(req.query.status);

    const { data, total } = await JobService.listForRequester(user.id, user.role, { status }, pagination);

    res
      .status(200)
      .json(ApiResponse.success(data, undefined, { page: pagination.page, limit: pagination.limit, total }));
  },

  async rate(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const rating = await RatingService.create(user.id, getParam(req, "id"), req.body);
    res.status(201).json(ApiResponse.success(rating, "Rating submitted"));
  },
};
