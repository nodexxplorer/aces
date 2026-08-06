import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_PREFIX = '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL + API_PREFIX,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export async function safeRequest<T>(request: () => Promise<{ data: { data: T } }>): Promise<T> {
  try {
    const response = await request();
    return response.data.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please try again.');
      }
      if (!err.response) {
        throw new Error('Network error. Please check your connection.');
      }
      if (err.response.data?.error) {
        throw new Error(err.response.data.error);
      }
      if (err.response.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error(`Request failed with status ${err.response.status}`);
    }
    if (err instanceof Error) throw err;
    throw new Error('An unexpected error occurred');
  }
}

// Concurrent requests that all 401 at once (e.g. every widget on a dashboard
// firing on mount) must share a single /auth/refresh call, not one each —
// otherwise every failed request independently races the refresh endpoint,
// hammering it and, if the refresh token gets rotated, can even invalidate
// sibling in-flight refreshes into spurious logouts.
let refreshPromise: Promise<void> | null = null;

function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {}, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      const url = originalRequest.url || '';
      const isAuthEndpoint =
        url.includes('/auth/login') || url.includes('/auth/signup') || url.includes('/auth/refresh');
      if (!isAuthEndpoint) {
        originalRequest._retry = true;
        try {
          await refreshAccessToken();
          return apiClient(originalRequest);
        } catch {
          // Clear the persisted "isAuthenticated" state before navigating —
          // otherwise PublicOnlyRoute sees isAuthenticated still true on
          // /login and immediately bounces back to /dashboard, which fires
          // the same failing requests again: a redirect loop that never
          // reaches the login form.
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      }
    }
    if (error.response?.status === 403) {
      const msg = error.response?.data?.error || 'You do not have permission to access this resource.';
      error.displayMessage = msg;
    }
    return Promise.reject(error);
  },
);

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
