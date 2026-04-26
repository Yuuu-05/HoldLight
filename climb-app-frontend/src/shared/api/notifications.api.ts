import { apiClient } from './client';

export type BackendNotificationType =
  | 'profile_incomplete';

export interface BackendNotification {
  id: string;
  type: BackendNotificationType;
  to: string;
  data: Record<string, string | number | boolean | null | undefined>;
}

export interface NotificationsResponse {
  notifications: BackendNotification[];
  readIds: string[];
}

export async function getNotificationsApi() {
  const { data } = await apiClient.get<{ success: boolean } & NotificationsResponse>('/notifications');
  return {
    notifications: data.notifications,
    readIds: data.readIds ?? [],
  };
}

export async function markNotificationsReadApi(notificationIds: string[]) {
  const { data } = await apiClient.post<{ success: boolean; readIds: string[] }>('/notifications/read', {
    notificationIds,
  });
  return data.readIds ?? [];
}
