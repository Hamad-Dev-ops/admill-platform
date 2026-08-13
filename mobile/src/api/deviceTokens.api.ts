import { apiClient } from './client';
import type { ApiSuccess } from '../types/api';
import type { DevicePlatform } from '../types/enums';

// frontend-docs/API-CONTRACT.md §DeviceToken (Milestone 8). Any authenticated
// role may call this — backend upserts by fcmToken, so re-registering the
// same physical device (app reopened, different user logged in) is safe to
// call repeatedly, not just once.
export interface DeviceTokenPayload {
  fcmToken: string;
  platform: DevicePlatform;
}

export async function registerDeviceToken(payload: DeviceTokenPayload): Promise<void> {
  await apiClient.post<ApiSuccess<unknown>>('/device-tokens', payload);
}
