import { model, Schema } from "mongoose";
import { IRefreshToken } from "../interfaces/refreshToken.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    tokenHash: { type: String, required: true, unique: true },

    deviceInfo: { type: String },

    // `expires: 0` creates a TTL index that expires the document exactly at this
    // field's timestamp, not N seconds after creation — the right MongoDB pattern
    // for "expire at this specific time" rather than "expire N seconds from now".
    expiresAt: { type: Date, required: true, expires: 0 },

    revokedAt: { type: Date },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const RefreshTokenModel = model<IRefreshToken>("RefreshToken", refreshTokenSchema);
