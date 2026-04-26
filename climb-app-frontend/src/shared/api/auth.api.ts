import { apiClient } from './client';
import type { AuthSuccessResponse, LoginPayload, RegisterPayload } from '../types/auth';

export async function loginApi(payload: LoginPayload) {
  const { data } = await apiClient.post<AuthSuccessResponse>('/auth/login', payload);
  return data;
}

export async function registerApi(payload: RegisterPayload) {
  const { data } = await apiClient.post<AuthSuccessResponse>('/auth/register', payload);
  return data;
}

export async function logoutApi() {
  const { data } = await apiClient.post<{ success: boolean; message: string }>('/auth/logout');
  return data;
}
