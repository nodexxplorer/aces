import apiClient, { unwrap } from './client';
import type { User, AuthTokens } from '../types';

// ─── Modools OAuth (students) ────────────────────────────────────────────
// Login is a browser redirect to the backend's /auth/modools/login (which
// 302s on to Modools) — never an XHR, since the whole point is leaving the
// SPA. The backend hands the session back through /auth/modools/complete,
// which stashes the login-shaped payload in localStorage under
// 'aces_auth_payload' before bouncing into the app; takeModoolsPayload()
// is the one-time consumer of that stash.

export interface ModoolsStatus {
  configured: boolean;
}

export const getModoolsStatus = async (): Promise<ModoolsStatus> => {
  const res = await apiClient.get('/auth/modools/status');
  return unwrap<ModoolsStatus>(res);
};

// The department travels as a query parameter: the backend reads it before it
// starts the OAuth handshake and stores it in a cookie for the callback.
export const modoolsLoginUrl = (tenant?: string) => {
  const base = apiClient.defaults.baseURL || '/api/v1';
  const query = tenant ? `?tenant=${encodeURIComponent(tenant)}` : '';
  return `${base}/auth/modools/login${query}`;
};

export interface ModoolsAuthPayload {
  user: User;
  tokens: AuthTokens;
}

const PAYLOAD_KEY = 'aces_auth_payload';

// Consume the stashed OAuth session payload exactly once (returns null when
// absent or corrupt). The base64url decode mirrors the backend's
// RawURLEncoding; TextDecoder handles the UTF-8 names correctly.
export const takeModoolsPayload = (): ModoolsAuthPayload | null => {
  try {
    const raw = localStorage.getItem(PAYLOAD_KEY);
    if (!raw) return null;
    localStorage.removeItem(PAYLOAD_KEY);
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed?.user && parsed?.tokens) return parsed as ModoolsAuthPayload;
    return null;
  } catch {
    return null;
  }
};
