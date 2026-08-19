import { AppNotification } from '@/types/models';
import { request } from '@main-mechanic/wire-client';

export async function getNotifications(): Promise<AppNotification[]> {
  return request<AppNotification[]>('/notifications');
}

export async function getUnreadNotificationCount(): Promise<number> {
  const result = await request<{ count: number }>('/notifications/unread-count');
  return result.count;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await request<void>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await request<void>('/notifications/read-all', {
    method: 'POST',
  });
}
