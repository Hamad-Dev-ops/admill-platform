import { Request, Response } from "express";
import { DocumentOwnerType } from "../../constants/document.enum";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { getParam } from "../../utils/request";
import { DocumentService } from "../document/document.service";
import { CompanyService } from "./company.service";

function requireOwnerId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user.id;
}

export const CompanyController = {
  async create(req: Request, res: Response): Promise<void> {
    const company = await CompanyService.createCompany(requireOwnerId(req), req.body);
    res.status(201).json(ApiResponse.success(company, "Company created successfully"));
  },

  async getMe(req: Request, res: Response): Promise<void> {
    const company = await CompanyService.getMyCompany(requireOwnerId(req));
    res.status(200).json(ApiResponse.success(company));
  },

  async updateMe(req: Request, res: Response): Promise<void> {
    const company = await CompanyService.updateMyCompany(requireOwnerId(req), req.body);
    res.status(200).json(ApiResponse.success(company, "Company updated successfully"));
  },

  async getMySettings(req: Request, res: Response): Promise<void> {
    const settings = await CompanyService.getMySettings(requireOwnerId(req));
    res.status(200).json(ApiResponse.success(settings));
  },

  async updateMySettings(req: Request, res: Response): Promise<void> {
    const settings = await CompanyService.updateMySettings(requireOwnerId(req), req.body);
    res.status(200).json(ApiResponse.success(settings, "Settings updated successfully"));
  },

  async lookupByCode(req: Request, res: Response): Promise<void> {
    const company = await CompanyService.lookupByCode(getParam(req, "companyCode"));
    res.status(200).json(ApiResponse.success(company));
  },

  async uploadDocument(req: Request, res: Response): Promise<void> {
    const ownerId = requireOwnerId(req);
    const company = await CompanyService.getMyCompany(ownerId);

    if (!req.file) {
      throw new AppError(400, "A file is required");
    }

    const document = await DocumentService.upload(
      DocumentOwnerType.COMPANY,
      company._id,
      req.body.documentType,
      req.file
    );

    res.status(201).json(ApiResponse.success(document, "Document uploaded successfully"));
  },

  async listDocuments(req: Request, res: Response): Promise<void> {
    const ownerId = requireOwnerId(req);
    const company = await CompanyService.getMyCompany(ownerId);
    const documents = await DocumentService.listByOwner(DocumentOwnerType.COMPANY, company._id);

    res.status(200).json(ApiResponse.success(documents));
  },
};
