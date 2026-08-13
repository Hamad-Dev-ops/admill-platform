import { Types } from "mongoose";
import { fileStorageProvider } from "../../infrastructure/providers/fileStorage/cloudinary.provider";
import { DocumentOwnerType, DocumentType, DocumentVerificationStatus } from "../../constants/document.enum";
import { AppError } from "../../errors/AppError";
import { DocumentRepository } from "../../repositories/document.repository";
import { DriverRepository } from "../../repositories/driver.repository";
import { VehicleRepository } from "../../repositories/vehicle.repository";
import { CompanyService } from "../company/company.service";

async function resolveCompanyIdForOwner(ownerType: DocumentOwnerType, ownerId: Types.ObjectId): Promise<Types.ObjectId> {
  if (ownerType === DocumentOwnerType.COMPANY) {
    return ownerId;
  }

  if (ownerType === DocumentOwnerType.DRIVER) {
    const driver = await DriverRepository.findById(ownerId);
    if (!driver) {
      throw new AppError(404, "Owning driver not found");
    }
    return driver.companyId;
  }

  const vehicle = await VehicleRepository.findById(ownerId);
  if (!vehicle) {
    throw new AppError(404, "Owning vehicle not found");
  }
  return vehicle.companyId;
}

export const DocumentService = {
  async upload(
    ownerType: DocumentOwnerType,
    ownerId: Types.ObjectId,
    documentType: DocumentType,
    file: Express.Multer.File
  ) {
    const fileUrl = await fileStorageProvider.upload(file.buffer, `documents/${ownerType.toLowerCase()}`);

    return DocumentRepository.create({ ownerType, ownerId, documentType, fileUrl });
  },

  async listByOwner(ownerType: DocumentOwnerType, ownerId: Types.ObjectId) {
    return DocumentRepository.findByOwner(ownerType, ownerId);
  },

  async verify(
    ownerId: string,
    documentId: string,
    status: DocumentVerificationStatus,
    rejectionReason: string | undefined
  ) {
    const document = await DocumentRepository.findById(documentId);

    if (!document) {
      throw new AppError(404, "Document not found");
    }

    const companyId = await resolveCompanyIdForOwner(document.ownerType, document.ownerId);
    await CompanyService.assertOwnerOwnsCompany(ownerId, companyId);

    return DocumentRepository.updateById(documentId, {
      verificationStatus: status,
      rejectionReason: status === DocumentVerificationStatus.REJECTED ? rejectionReason : undefined,
      verifiedBy: new Types.ObjectId(ownerId),
      verifiedAt: new Date(),
    });
  },
};
