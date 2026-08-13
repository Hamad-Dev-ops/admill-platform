import { z } from "zod";
import { DocumentType, DocumentVerificationStatus } from "../../constants/document.enum";

const documentTypeValues = Object.values(DocumentType) as [DocumentType, ...DocumentType[]];

export const uploadDocumentSchema = z.object({
  documentType: z.enum(documentTypeValues),
});

export const verifyDocumentSchema = z.object({
  status: z.enum([DocumentVerificationStatus.VERIFIED, DocumentVerificationStatus.REJECTED]),
  rejectionReason: z.string().min(1).optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;
