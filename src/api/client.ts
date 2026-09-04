import axios from 'axios';
import { Platform } from 'react-native';
import useAuthStore from '../store/authStore';
import { expireAuthSessionForUnauthorizedRequest, isJwtExpired } from './storage';

// Access environment variables in Expo
export const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://lad-backend-develop-160078175457.us-central1.run.app';

const DEFAULT_WEB_API_URL = 'http://localhost:8091';

export const RESOLVED_API_URL =
  Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_WEB_API_URL || DEFAULT_WEB_API_URL
    : API_URL;

export const apiClient = axios.create({
  baseURL: RESOLVED_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      if (isJwtExpired(token)) {
        void useAuthStore.getState().logout();
        return config;
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401) {
      const authorization = originalRequest?.headers?.Authorization;
      const requestToken = typeof authorization === 'string'
        ? authorization.replace(/^Bearer\s+/i, '')
        : null;
      await expireAuthSessionForUnauthorizedRequest(originalRequest?.url || '', requestToken);
    }

    return Promise.reject(error);
  }
);
