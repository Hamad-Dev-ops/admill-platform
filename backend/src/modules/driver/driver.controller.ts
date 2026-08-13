import { Request, Response } from "express";
import { DocumentOwnerType } from "../../constants/document.enum";
import { DriverApprovalStatus } from "../../constants/driver.enum";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { resolvePagination } from "../../utils/pagination";
import { getParam } from "../../utils/request";
import { DocumentService } from "../document/document.service";
import { RatingService } from "../rating/rating.service";
import { TrackingService } from "../tracking/tracking.service";
import { DriverService } from "./driver.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user;
}

function parseApprovalStatusFilter(value: unknown): DriverApprovalStatus | undefined {
  if (typeof value === "string" && (Object.values(DriverApprovalStatus) as string[]).includes(value)) {
    return value as DriverApprovalStatus;
  }

  return undefined;
}

export const DriverController = {
  async register(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.register(user.id, req.body);
    res.status(201).json(ApiResponse.success(driver, "Driver registered — pending approval"));
  },

  async getMe(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.getMyProfile(user.id);
    res.status(200).json(ApiResponse.success(driver));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.getById(user.id, user.role, getParam(req, "id"));
    res.status(200).json(ApiResponse.success(driver));
  },

  async updateById(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.updateById(user.id, user.role, getParam(req, "id"), req.body);
    res.status(200).json(ApiResponse.success(driver, "Driver updated successfully"));
  },

  async approve(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.approve(user.id, getParam(req, "id"));
    res.status(200).json(ApiResponse.success(driver, "Driver approved successfully"));
  },

  async reject(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.reject(user.id, getParam(req, "id"), req.body.reason);
    res.status(200).json(ApiResponse.success(driver, "Driver rejected"));
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const pagination = resolvePagination(req.query);
    const approvalStatus = parseApprovalStatusFilter(req.query.approvalStatus);

    const { data, total } = await DriverService.listForMyCompany(user.id, { approvalStatus }, pagination);

    res.status(200).json(ApiResponse.success(data, undefined, { page: pagination.page, limit: pagination.limit, total }));
  },

  async uploadDocument(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.getRawById(user.id, user.role, getParam(req, "id"));

    if (!req.file) {
      throw new AppError(400, "A file is required");
    }

    const document = await DocumentService.upload(
      DocumentOwnerType.DRIVER,
      driver._id,
      req.body.documentType,
      req.file
    );

    res.status(201).json(ApiResponse.success(document, "Document uploaded successfully"));
  },

  async listDocuments(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.getRawById(user.id, user.role, getParam(req, "id"));
    const documents = await DocumentService.listByOwner(DocumentOwnerType.DRIVER, driver._id);

    res.status(200).json(ApiResponse.success(documents));
  },

  async updateMyLocation(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.updateMyLocation(user.id, req.body);
    res.status(200).json(ApiResponse.success(driver, "Location updated"));
  },

  async updateMyStatus(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.updateMyStatus(user.id, req.body);
    res.status(200).json(ApiResponse.success(driver, "Status updated"));
  },

  // Fallback/debug endpoint (architecture-baseline §23, Milestone 7) — live updates
  // are the socket path; this is a point-in-time REST read, same authorization rules.
  async getLocation(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const result = await TrackingService.getDriverLocation(user.id, user.role, getParam(req, "id"));
    res.status(200).json(ApiResponse.success(result));
  },

  async listRatings(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const driver = await DriverService.getRawById(user.id, user.role, getParam(req, "id"));
    const pagination = resolvePagination(req.query);

    const { data, total } = await RatingService.listForDriver(driver._id!, pagination);

    res
      .status(200)
      .json(ApiResponse.success(data, undefined, { page: pagination.page, limit: pagination.limit, total }));
  },
};
