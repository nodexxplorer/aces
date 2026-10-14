import type { Department } from '../api/departments';

/** Format department name from 'Department of ...' to 'Dept of ...' */
export function formatDepartmentDisplayName(name?: string): string {
  if (!name) return '';
  return name.replace(/^Department of\s+/i, 'Dept of ');
}

/** Pre-loaded default departments so there is zero flash of the generic placeholder */
export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    slug: 'uniuyo-ce',
    name: 'Dept of Computer Engineering',
    matricCode: 'EG/CO',
    urlCode: 'co',
    institution: 'University of Uyo',
    faculty: 'Faculty of Engineering',
    default: true,
    logoUrl: '/api/v1/tenants/uniuyo-ce/logo',
  },
  {
    slug: 'dept-ee',
    name: 'Dept of Electrical Engineering',
    matricCode: 'EG/EE',
    urlCode: 'ee',
    institution: 'University of Uyo',
    faculty: 'Faculty of Engineering',
    logoUrl: '/api/v1/tenants/dept-ee/logo',
  },
  {
    slug: 'dept-ce',
    name: 'Dept of Chemical Engineering',
    matricCode: 'EG/CE',
    urlCode: 'ce',
    institution: 'University of Uyo',
    faculty: 'Faculty of Engineering',
    logoUrl: '/api/v1/tenants/dept-ce/logo',
  },
  {
    slug: 'dept-pe',
    name: 'Dept of Petroleum Engineering',
    matricCode: 'EG/PE',
    urlCode: 'pe',
    institution: 'University of Uyo',
    faculty: 'Faculty of Engineering',
    logoUrl: '/api/v1/tenants/dept-pe/logo',
  },
  {
    slug: 'dept-ae',
    name: 'Dept of Agricultural Engineering',
    matricCode: 'EG/AE',
    urlCode: 'ae',
    institution: 'University of Uyo',
    faculty: 'Faculty of Engineering',
    logoUrl: '/api/v1/tenants/dept-ae/logo',
  },
  {
    slug: 'dept-fe',
    name: 'Dept of Food Engineering',
    matricCode: 'EG/FE',
    urlCode: 'fe',
    institution: 'University of Uyo',
    faculty: 'Faculty of Engineering',
    logoUrl: '/api/v1/tenants/dept-fe/logo',
  },
  {
    slug: 'dept-cv',
    name: 'Dept of Civil Engineering',
    matricCode: 'EG/CV',
    urlCode: 'cv',
    institution: 'University of Uyo',
    faculty: 'Faculty of Engineering',
    logoUrl: '/api/v1/tenants/dept-cv/logo',
  },
  {
    slug: 'dept-me',
    name: 'Dept of Mechanical Engineering',
    matricCode: 'EG/ME',
    urlCode: 'me',
    institution: 'University of Uyo',
    faculty: 'Faculty of Engineering',
    logoUrl: '/api/v1/tenants/dept-me/logo',
  },
];

// The department (tenant) a person signs in to is chosen on the sign-in and
// sign-up pages and remembered in this browser. An empty value means "the
// server's default department", which is also what the mobile app uses.
const STORAGE_KEY = 'aces_department';

export function getStoredDepartment(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeDepartment(slug: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // Storage can be unavailable (for example in some private modes). The
    // choice then lasts only for the current page.
  }
}

/** The staff portal's sign-in path. VITE_STAFF_PORTAL_PATH can move it, as in the router. */
export const STAFF_LOGIN_PATH = `${import.meta.env.VITE_STAFF_PORTAL_PATH || '/portalsign'}/login`;

/** The department whose web address code is code (case-insensitive), if any. */
export function departmentByUrlCode<T extends { urlCode?: string }>(
  departments: readonly T[],
  code?: string,
): T | undefined {
  if (!code) return undefined;
  const wanted = code.toLowerCase();
  return departments.find((d) => d.urlCode === wanted);
}

/**
 * A department's own sign-in address: /co for students, /co/admin for admins.
 * A department without a code gets the generic sign-in page instead.
 */
export function departmentSignInPath(department: { urlCode?: string } | undefined, admin: boolean): string {
  if (department?.urlCode) return admin ? `/${department.urlCode}/admin` : `/${department.urlCode}`;
  return admin ? STAFF_LOGIN_PATH : '/login';
}
