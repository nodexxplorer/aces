import apiClient from './client';
import type { AuthTokens, AuthUser } from '../store/authStore';

/** Whether the server has Modools set up. Sign-in is unavailable when it is not. */
export async function modoolsConfigured(): Promise<boolean> {
  const { data } = await apiClient.get<{ configured?: boolean }>('/auth/modools/status');
  return data?.configured === true;
}

/**
 * The address that starts a Modools sign-in in the browser. client=mobile asks
 * the server to end the sign-in with a one-time code for the app. The challenge
 * is the app's PKCE challenge, and the code is bound to it. The department is the
 * tenant. On the web the API base can be a path, so it is made absolute there.
 */
export function modoolsStartUrl(tenant: string, challenge: string): string {
  const base = (apiClient.defaults.baseURL ?? '/api/v1').replace(/\/$/, '');
  const origin = base.startsWith('/') && typeof window !== 'undefined' ? window.location.origin : '';
  const tenantPart = tenant ? `&tenant=${encodeURIComponent(tenant)}` : '';
  return `${origin}${base}/auth/modools/login?client=mobile${tenantPart}&code_challenge=${encodeURIComponent(challenge)}`;
}

/** A session, as the server returns it. */
export interface ModoolsSession {
  user: AuthUser;
  tokens: AuthTokens;
}

/**
 * Trades the one-time code from the browser for the session. The verifier must
 * be the one whose challenge started the sign-in. A refusal is an axios error
 * whose response carries an `error` code.
 */
export async function exchangeModoolsCode(input: {
  code: string;
  verifier: string;
  tenant: string;
}): Promise<ModoolsSession> {
  const { data } = await apiClient.post<ModoolsSession>('/auth/modools/exchange', input);
  return data;
}
