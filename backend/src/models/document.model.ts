import { model, Schema } from "mongoose";
import { DocumentOwnerType, DocumentType, DocumentVerificationStatus } from "../constants/document.enum";
import { IDocument } from "../interfaces/document.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const documentSchema = new Schema<IDocument>(
  {
    ownerType: { type: String, enum: Object.values(DocumentOwnerType), required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },

    documentType: { type: String, enum: Object.values(DocumentType), required: true },

    fileUrl: { type: String, required: true },
    expiryDate: { type: Date },

    verificationStatus: {
      type: String,
      enum: Object.values(DocumentVerificationStatus),
      default: DocumentVerificationStatus.PENDING,
    },
    rejectionReason: { type: String },

    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

// One approval queue across everything (Decision #10): index supports both
// "all documents for this owner" and "all pending documents company-wide" queries.
documentSchema.index({ ownerType: 1, ownerId: 1 });

export const DocumentModel = model<IDocument>("Document", documentSchema);
