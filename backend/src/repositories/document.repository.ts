import { Types } from "mongoose";
import { DocumentOwnerType } from "../constants/document.enum";
import { IDocument } from "../interfaces/document.interface";
import { DocumentModel } from "../models/document.model";

export const DocumentRepository = {
  async create(data: Pick<IDocument, "ownerType" | "ownerId" | "documentType" | "fileUrl" | "expiryDate">) {
    return DocumentModel.create(data);
  },

  async findById(id: string | Types.ObjectId) {
    return DocumentModel.findOne({ _id: id, isDeleted: false });
  },

  async findByOwner(ownerType: DocumentOwnerType, ownerId: string | Types.ObjectId) {
    return DocumentModel.find({ ownerType, ownerId, isDeleted: false });
  },

  async updateById(id: string | Types.ObjectId, data: Partial<IDocument>) {
    return DocumentModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, { returnDocument: "after" });
  },
};
