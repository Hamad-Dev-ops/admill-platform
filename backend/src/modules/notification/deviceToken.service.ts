import { DevicePlatform } from "../../constants/device.enum";
import { DeviceTokenRepository } from "../../repositories/deviceToken.repository";

export const DeviceTokenService = {
  async register(userId: string, fcmToken: string, platform: DevicePlatform) {
    return DeviceTokenRepository.upsertByToken(userId, fcmToken, platform);
  },
};
