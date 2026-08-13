import { apiClient } from './client';
import type { ApiSuccess, PaginationMeta } from '../types/api';
import type { Notification } from '../types/entities';

// frontend-docs/API-CONTRACT.md §Notifications & device tokens — self-scoped
// only, no role restriction beyond "must be your own".

export async function listNotifications(params?: {
  page?: number;
  limit?: number;
  isRead?: boolean;
}): Promise<{ data: Notification[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiSuccess<Notification[]>>('/notifications', {
    params: params
      ? { ...params, isRead: params.isRead === undefined ? undefined : String(params.isRead) }
      : undefined,
  });
  return { data: data.data, meta: data.meta! };
}

export async function markNotificationRead(notificationId: string): Promise<Notification> {
  const { data } = await apiClient.patch<ApiSuccess<Notification>>(
    `/notifications/${notificationId}/read`,
  );
  return data.data;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { meta } = await listNotifications({ isRead: false, limit: 1 });
  return meta.total;
}
