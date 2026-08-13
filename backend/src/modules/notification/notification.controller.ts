import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { resolvePagination } from "../../utils/pagination";
import { getParam } from "../../utils/request";
import { NotificationService } from "./notification.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user;
}

function parseIsReadFilter(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export const NotificationController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const pagination = resolvePagination(req.query);
    const isRead = parseIsReadFilter(req.query.isRead);

    const { data, total } = await NotificationService.listForUser(user.id, { isRead }, pagination);

    res
      .status(200)
      .json(ApiResponse.success(data, undefined, { page: pagination.page, limit: pagination.limit, total }));
  },

  async markAsRead(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const notification = await NotificationService.markAsRead(user.id, getParam(req, "id"));
    res.status(200).json(ApiResponse.success(notification, "Notification marked as read"));
  },
};
