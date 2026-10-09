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
