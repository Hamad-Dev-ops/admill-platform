import { Types } from "mongoose";

/**
 * Base interface shared by all database models.
 * Provides common fields inherited by every entity.
 */
export interface IBase {
  _id?: Types.ObjectId;

  isActive: boolean;

  isDeleted: boolean;

  createdAt?: Date;

  updatedAt?: Date;
}