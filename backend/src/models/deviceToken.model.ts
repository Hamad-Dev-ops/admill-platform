import { model, Schema } from "mongoose";
import { DevicePlatform } from "../constants/device.enum";
import { IDeviceToken } from "../interfaces/deviceToken.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Unique, not just indexed: the same physical device re-registering (app reopened,
    // a different user logged in on it) upserts this one document rather than
    // accumulating duplicate token rows for the same device.
    fcmToken: { type: String, required: true, unique: true },

    platform: { type: String, enum: Object.values(DevicePlatform), required: true },
    lastUsedAt: { type: Date, default: Date.now },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

export const DeviceTokenModel = model<IDeviceToken>("DeviceToken", deviceTokenSchema);
