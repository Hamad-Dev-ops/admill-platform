import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { ApiResponse } from "../../responses/ApiResponse";
import { getParam } from "../../utils/request";
import { DocumentService } from "./document.service";

export const DocumentController = {
  async verify(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError(401, "Authentication required");
    }

    const { status, rejectionReason } = req.body;
    const document = await DocumentService.verify(req.user.id, getParam(req, "id"), status, rejectionReason);

    res.status(200).json(ApiResponse.success(document, "Document verification status updated"));
  },
};
