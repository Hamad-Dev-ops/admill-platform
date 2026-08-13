import { z } from "zod";
import { DevicePlatform } from "../../constants/device.enum";

export const registerDeviceTokenSchema = z.object({
  fcmToken: z.string().min(1),
  platform: z.enum(Object.values(DevicePlatform) as [DevicePlatform, ...DevicePlatform[]]),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;
