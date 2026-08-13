import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { AnalyticsService, IDateRange } from "./analytics.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user;
}

// No existing precedent for query-string date parsing anywhere in this codebase
// (resolvePagination/parseStatusFilter-style manual query parsing is the closest —
// no Zod query-schema pattern exists, validate() is only ever used for bodies).
// Missing bounds default to "all time" rather than erroring, matching this
// codebase's general bias toward sensible defaults over required query params
// (resolvePagination defaults page/limit the same way).
function parseDateRange(query: Request["query"]): IDateRange {
  const startDate = typeof query.startDate === "string" ? new Date(query.startDate) : new Date(0);
  const endDate = typeof query.endDate === "string" ? new Date(query.endDate) : new Date();

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new AppError(400, "Invalid startDate/endDate");
  }

  return { startDate, endDate };
}

export const AnalyticsController = {
  async getRevenue(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const result = await AnalyticsService.getRevenue(user.id, parseDateRange(req.query));
    res.status(200).json(ApiResponse.success(result));
  },

  async getDriverStats(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const result = await AnalyticsService.getDriverStats(user.id, parseDateRange(req.query));
    res.status(200).json(ApiResponse.success(result));
  },

  async getFleetUtilization(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const result = await AnalyticsService.getFleetUtilization(user.id, parseDateRange(req.query));
    res.status(200).json(ApiResponse.success(result));
  },
};
