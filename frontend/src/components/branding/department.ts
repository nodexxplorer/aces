import { useAuthStore } from '../../stores/authStore';
import type { TenantInfo } from '../../types';
export { formatDepartmentDisplayName } from '../../config/department';

/**
 * The logo is served by the API, so its path is joined to the API's base address.
 * Returns undefined when the department has no logo.
 */
export function departmentLogoUrl(logoUrl?: string): string | undefined {
  if (!logoUrl) return undefined;
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  return `${base}${logoUrl}`;
}

/** Local department logos bundled from branding/department-logos */
export const DEPARTMENT_LOGOS: Record<string, string> = {
  'EG/AE': '/department-logos/EG-AE.png',
  'EG/CE': '/department-logos/EG-CE.png',
  'EG/CO': '/department-logos/EG-CO.png',
  'EG/CV': '/department-logos/EG-CV.png',
  'EG/EE': '/department-logos/EG-EE.png',
  'EG/FE': '/department-logos/EG-FE.png',
  'EG/ME': '/department-logos/EG-ME.png',
  'EG/PE': '/department-logos/EG-PE.png',
  'dept-ae': '/department-logos/EG-AE.png',
  'dept-ce': '/department-logos/EG-CE.png',
  'uniuyo-ce': '/department-logos/EG-CO.png',
  'dept-cv': '/department-logos/EG-CV.png',
  'dept-ee': '/department-logos/EG-EE.png',
  'dept-fe': '/department-logos/EG-FE.png',
  'dept-me': '/department-logos/EG-ME.png',
  'dept-pe': '/department-logos/EG-PE.png',
  ae: '/department-logos/EG-AE.png',
  ce: '/department-logos/EG-CE.png',
  co: '/department-logos/EG-CO.png',
  cv: '/department-logos/EG-CV.png',
  ee: '/department-logos/EG-EE.png',
  fe: '/department-logos/EG-FE.png',
  me: '/department-logos/EG-ME.png',
  pe: '/department-logos/EG-PE.png',
};

/** Get the local logo path for a given department from branding/department-logos */
export function getDepartmentLocalLogo(department?: Partial<TenantInfo>): string | undefined {
  if (!department) return undefined;
  if (department.matricCode && DEPARTMENT_LOGOS[department.matricCode.toUpperCase()]) {
    return DEPARTMENT_LOGOS[department.matricCode.toUpperCase()];
  }
  if (department.slug && DEPARTMENT_LOGOS[department.slug.toLowerCase()]) {
    return DEPARTMENT_LOGOS[department.slug.toLowerCase()];
  }
  if (department.urlCode && DEPARTMENT_LOGOS[department.urlCode.toLowerCase()]) {
    return DEPARTMENT_LOGOS[department.urlCode.toLowerCase()];
  }
  return undefined;
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
