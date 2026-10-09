import apiClient, { unwrap } from './client';
import type { User, AuthTokens } from '../types';

// ─── Modools OAuth (students) ────────────────────────────────────────────
// Login is a browser redirect to the backend's /auth/modools/login (which
// 302s on to Modools) — never an XHR, since the whole point is leaving the
// SPA. The backend sends the session back to /login with the payload in the
// URL fragment; takeModoolsPayload() reads it once and clears the fragment.

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

/**
 * Read the session that the backend returned in the fragment of this page's
 * address (/login#auth=<base64url JSON of {user, tokens}>), then clear the
 * fragment so the tokens stay out of the address bar and browser history.
 * Returns null when there is no session or it cannot be read.
 */
export const takeModoolsPayload = (): ModoolsAuthPayload | null => {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    const auth = new URLSearchParams(hash).get('auth');
    if (!auth) return null;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    // base64url, unpadded, as the backend's RawURLEncoding writes it. TextDecoder
    // handles the UTF-8 names correctly.
    const b64 = auth.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed?.user && parsed?.tokens) return parsed as ModoolsAuthPayload;
    return null;
  } catch {
    return null;
  }
};
