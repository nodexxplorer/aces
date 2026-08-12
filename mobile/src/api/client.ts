import axios from 'axios';
import { getStoredAccessToken, getStoredRefreshToken, useAuthStore } from '../store/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// The web app relies on an httpOnly cookie; there's no such thing on native,
// so every request carries the access token as a Bearer header instead — the
// backend's JWT middleware already supports both (cookie first, header
// fallback), so this needs zero backend changes.
apiClient.interceptors.request.use(async (config) => {
  const token = await getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await getStoredRefreshToken();
        if (!refreshToken) return null;
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const tokens = data?.data ?? data;
        if (!tokens?.accessToken) return null;
        await useAuthStore.getState().setTokens(tokens);
        return tokens.accessToken as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      const url = originalRequest.url ?? '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh');
      if (!isAuthEndpoint) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
        await useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);

// Matches the web app's unwrap() so API modules ported from frontend/src/api
// need minimal changes: backend responses are either a bare array/object or
// { data: ... } — this normalizes both.
export function unwrap<T>(response: { data: unknown }): T {
  const body = response.data;
  if (body === null || body === undefined) return [] as unknown as T;
  if (Array.isArray(body)) return body as T;
  if (body && typeof body === 'object' && 'data' in body) {
    const d = (body as { data: unknown }).data;
    if (d === null || d === undefined) return [] as unknown as T;
    return d as T;
  }
  return body as T;
}

export default apiClient;
