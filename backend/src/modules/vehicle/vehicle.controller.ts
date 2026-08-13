import { Request, Response } from "express";
import { DocumentOwnerType } from "../../constants/document.enum";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { resolvePagination } from "../../utils/pagination";
import { getParam } from "../../utils/request";
import { DocumentService } from "../document/document.service";
import { VehicleService } from "./vehicle.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user;
}

export const VehicleController = {
  async create(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const vehicle = await VehicleService.create(user.id, req.body);
    res.status(201).json(ApiResponse.success(vehicle, "Vehicle created successfully"));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const vehicle = await VehicleService.getById(user.id, user.role, getParam(req, "id"));
    res.status(200).json(ApiResponse.success(vehicle));
  },

  async updateById(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const vehicle = await VehicleService.updateById(user.id, getParam(req, "id"), req.body);
    res.status(200).json(ApiResponse.success(vehicle, "Vehicle updated successfully"));
  },

  async assignDriver(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const vehicle = await VehicleService.assignDriver(user.id, getParam(req, "id"), req.body.driverId);
    res.status(200).json(ApiResponse.success(vehicle, "Driver assigned successfully"));
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const pagination = resolvePagination(req.query);
    const { data, total } = await VehicleService.listForMyCompany(user.id, pagination);
    res.status(200).json(ApiResponse.success(data, undefined, { page: pagination.page, limit: pagination.limit, total }));
  },

  async uploadDocument(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const vehicle = await VehicleService.getById(user.id, user.role, getParam(req, "id"));

    if (!req.file) {
      throw new AppError(400, "A file is required");
    }

    const document = await DocumentService.upload(
      DocumentOwnerType.VEHICLE,
      vehicle._id,
      req.body.documentType,
      req.file
    );

    res.status(201).json(ApiResponse.success(document, "Document uploaded successfully"));
  },

  async listDocuments(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const vehicle = await VehicleService.getById(user.id, user.role, getParam(req, "id"));
    const documents = await DocumentService.listByOwner(DocumentOwnerType.VEHICLE, vehicle._id);

    res.status(200).json(ApiResponse.success(documents));
  },
};
