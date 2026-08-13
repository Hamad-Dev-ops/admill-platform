import { SchemaOptions } from "mongoose";

/**
 * Reusable Mongoose timestamp configuration.
 * Automatically adds:
 * - createdAt
 * - updatedAt
 */
export const timestamps: Pick<SchemaOptions, "timestamps"> = {
  timestamps: true,
};