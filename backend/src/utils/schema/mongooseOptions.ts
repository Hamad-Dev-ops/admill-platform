import { SchemaOptions } from "mongoose";

/**
 * Global schema options shared across all models.
 */
export const mongooseOptions: SchemaOptions = {
  versionKey: false,

  timestamps: true,

  minimize: false,

  toJSON: {
    virtuals: true,

    transform(_doc, ret) {
      delete (ret as any).__v;
      return ret;
    },
  },

  toObject: {
    virtuals: true,
  },
};