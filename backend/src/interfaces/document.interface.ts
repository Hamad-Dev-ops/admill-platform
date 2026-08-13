import { Types } from "mongoose";
import { DocumentOwnerType, DocumentType, DocumentVerificationStatus } from "../constants/document.enum";
import { IBase } from "./base.interface";

export interface IDocument extends IBase {
  ownerType: DocumentOwnerType;

  ownerId: Types.ObjectId;

  documentType: DocumentType;

  fileUrl: string;

  expiryDate?: Date;

  verificationStatus: DocumentVerificationStatus;

  rejectionReason?: string;

  verifiedBy?: Types.ObjectId;

  verifiedAt?: Date;
}
