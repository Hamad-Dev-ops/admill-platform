import { Types } from "mongoose";
import { DevicePlatform } from "../constants/device.enum";
import { DeviceTokenModel } from "../models/deviceToken.model";

export const DeviceTokenRepository = {
  // Upsert by fcmToken (not userId): the same physical device re-registering — app
  // reopened, or a different user now logged in on it — updates this one document
  // rather than accumulating duplicate rows for the same device.
  async upsertByToken(userId: string | Types.ObjectId, fcmToken: string, platform: DevicePlatform) {
    return DeviceTokenModel.findOneAndUpdate(
      { fcmToken },
      { userId, fcmToken, platform, lastUsedAt: new Date(), isDeleted: false },
      { upsert: true, returnDocument: "after" }
    );
  },

  async findByUserId(userId: string | Types.ObjectId) {
    return DeviceTokenModel.find({ userId, isDeleted: false });
  },
};
