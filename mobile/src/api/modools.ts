import apiClient from './client';

/** Whether the server has Modools set up. Sign-in is unavailable when it is not. */
export async function modoolsConfigured(): Promise<boolean> {
  const { data } = await apiClient.get<{ configured?: boolean }>('/auth/modools/status');
  return data?.configured === true;
}

/**
 * The address that starts a Modools sign-in in the browser. client=mobile asks
 * the server to send the result back to the app. The department is the tenant.
 * On the web the API base can be a path, so it is made absolute there.
 */
export function modoolsStartUrl(tenant: string): string {
  const base = (apiClient.defaults.baseURL ?? '/api/v1').replace(/\/$/, '');
  const origin = base.startsWith('/') && typeof window !== 'undefined' ? window.location.origin : '';
  const tenantPart = tenant ? `&tenant=${encodeURIComponent(tenant)}` : '';
  return `${origin}${base}/auth/modools/login?client=mobile${tenantPart}`;
}
