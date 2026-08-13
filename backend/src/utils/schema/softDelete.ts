import { SchemaDefinition } from "mongoose";

/**
 * Reusable soft delete fields.
 * These fields can be spread into any Mongoose schema.
 */
export const softDeleteDefinition: SchemaDefinition = {
  isActive: {
    type: Boolean,
    default: true,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },
};