import axios from 'axios';
import { env } from '../../app/config/env';
import { readStorage, storageKeys } from '../lib/storage';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = readStorage<string | null>(storageKeys.token, null);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Vision inference is taking longer than expected. Please wait a bit longer or try scanning again.'));
    }

    const message = error?.response?.data?.message || error?.message || 'Request failed';
    return Promise.reject(new Error(message));
  },
);
