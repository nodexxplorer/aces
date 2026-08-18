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

// Double-submit CSRF defense: login/signup/refresh return a csrfToken in
// their JSON body (see tokenPair.CsrfToken on the backend) which we hold in
// memory and echo back as X-CSRF-Token on state-changing requests. The
// backend also sets this same value as a non-httpOnly cookie, but frontend
// and backend live on unrelated domains (Vercel + Render) — document.cookie
// can only ever see cookies set by the current page's own origin, never one
// set by a cross-origin API response — so reading it from the cookie jar
// would always come up empty. Holding the value from the response body
// sidesteps that entirely.
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null | undefined) {
  csrfToken = token ?? null;
}

apiClient.interceptors.request.use((config) => {
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
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
      .then((response) => {
        setCsrfToken(response.data?.data?.csrfToken);
      })
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

    // The backend's connection to its database has shown highly variable
    // latency in practice — some requests take 15-45+ seconds even though
    // they eventually complete successfully server-side, well past this
    // client's 15s timeout. A user then sees "no data" for something that
    // was never actually missing, just slow. GETs are safe to retry
    // (idempotent), so give a timed-out/network-failed GET up to two more
    // tries before surfacing an error — each retry opens a fresh
    // connection, which often lands outside whatever caused the stall.
    const isTimeoutOrNetworkError =
      !error.response && (error.code === 'ECONNABORTED' || error.message === 'Network Error');
    if (isTimeoutOrNetworkError && originalRequest?.method?.toLowerCase() === 'get') {
      originalRequest._timeoutRetryCount = (originalRequest._timeoutRetryCount ?? 0) + 1;
      if (originalRequest._timeoutRetryCount <= 2) {
        return apiClient(originalRequest);
      }
    }

    // The in-memory CSRF token (see setCsrfToken above) doesn't survive a
    // page reload — only `user`/`isAuthenticated` are persisted, not
    // `tokens` (see authStore's partialize) — even though the session
    // cookie itself is still valid. The first mutating request after a
    // reload then 403s with this exact message. Route it through the same
    // refresh-and-retry path as an expired access token: refreshing also
    // mints a fresh CSRF token, so the retried request succeeds without the
    // user ever seeing the failure.
    const csrfError =
      error.response?.status === 403 &&
      (error.response?.data?.error === 'missing csrf token' || error.response?.data?.error === 'invalid csrf token');
    if ((error.response?.status === 401 || csrfError) && !originalRequest._retry) {
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
          setCsrfToken(null);
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
