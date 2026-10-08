import { useAuthStore } from '../../stores/authStore';
import type { TenantInfo } from '../../types';

/**
 * The logo is served by the API, so its path is joined to the API's base address.
 * Returns undefined when the department has no logo.
 */
export function departmentLogoUrl(logoUrl?: string): string | undefined {
  if (!logoUrl) return undefined;
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  return `${base}${logoUrl}`;
}

/** The department the signed-in user belongs to, when known. */
export function useCurrentDepartment(): TenantInfo | undefined {
  return useAuthStore((state) => state.user?.tenant);
}
