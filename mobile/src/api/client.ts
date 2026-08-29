import axios from 'axios';
import { getStoredAccessToken, getStoredRefreshToken, useAuthStore } from '../store/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

// Uploaded files (avatars, etc.) are served from the API server's root
// (e.g. /uploads/profile-photos/xyz.jpg), not under /api/v1 — strip that
// suffix to get the plain server origin for building those URLs.
const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

// The backend stores/returns upload paths as server-relative
// (e.g. "/uploads/profile-photos/xyz.jpg"). A relative path like that
// resolves fine in a browser (relative to the page's own origin) but is
// meaningless to React Native's <Image> on a device — there's no "current
// page" to resolve it against, so it silently fails to load. Every avatar/
// upload URL from the API must go through this before being used as an
// Image source.
export function getMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  // Identifies every request as coming from the mobile app — the backend
  // uses this to reject login/refresh for lecturer/hod/admin accounts,
  // which this app isn't built for (see isMobileClient in auth.go). The
  // web app never sends this header, so it's unaffected.
  headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
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

    // Mirrors frontend/src/api/client.ts — the backend's connection to its
    // database has shown highly variable latency (some requests take
    // 15-45+ seconds even though they eventually complete successfully
    // server-side), well past this client's 15s timeout. A timed-out GET
    // then looks like "no data" rather than "still loading". GETs are
    // idempotent, so retry up to twice — each attempt opens a fresh
    // connection, which often lands outside whatever caused the stall.
    const isTimeoutOrNetworkError =
      !error.response && (error.code === 'ECONNABORTED' || error.message === 'Network Error');
    if (isTimeoutOrNetworkError && originalRequest?.method?.toLowerCase() === 'get') {
      originalRequest._timeoutRetryCount = (originalRequest._timeoutRetryCount ?? 0) + 1;
      if (originalRequest._timeoutRetryCount <= 2) {
        return apiClient(originalRequest);
      }
    }

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
