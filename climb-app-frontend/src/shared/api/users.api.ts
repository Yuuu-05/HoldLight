import { apiClient } from './client';
import type { User, UserProfile } from '../types/user';
import type { UserPreferences, UserPreferencesUpdate } from '../types/preferences';

export async function getCurrentUserApi() {
  const { data } = await apiClient.get<{ success: boolean; user: User }>('/users/me');
  return data.user;
}

export async function getCurrentRoleApi() {
  const { data } = await apiClient.get<{ success: boolean; role: string }>('/users/me/role');
  return data.role;
}

export async function updateCurrentUserApi(payload: { username?: string; profile?: UserProfile }) {
  const { data } = await apiClient.put<{ success: boolean; user: User }>('/users/me', payload);
  return data.user;
}

export async function getUserPreferencesApi() {
  const { data } = await apiClient.get<{ success: boolean; preferences: UserPreferences }>('/users/me/preferences');
  return data.preferences;
}

export async function updateUserPreferencesApi(payload: UserPreferencesUpdate) {
  const { data } = await apiClient.patch<{ success: boolean; preferences: UserPreferences }>(
    '/users/me/preferences',
    payload,
  );
  return data.preferences;
}
