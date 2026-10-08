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

/**
 * The department's name without its "Department of" prefix, for example
 * "Computer Engineering". Undefined when there is no name.
 */
export function departmentShortName(name?: string): string | undefined {
  const short = name
    ?.trim()
    .replace(/^Department of\s+/i, '')
    .trim();
  return short || undefined;
}

/** The assistant's name: "Computer Engineering Assistant", or "Admin Pack Assistant" with no department. */
export function assistantName(department?: Pick<TenantInfo, 'name'>): string {
  const short = departmentShortName(department?.name);
  return short ? `${short} Assistant` : 'Admin Pack Assistant';
}

/** How a department's alumni are named: "Computer Engineering alumni", or "alumni" with no department. */
export function alumniLabel(department?: Pick<TenantInfo, 'name'>): string {
  const short = departmentShortName(department?.name);
  return short ? `${short} alumni` : 'alumni';
}
