// Admin addresses. Every department's staff area lives under its own short
// name: /co/admin for Computer Engineering, /ee/admin for Electrical
// Engineering and so on. A department with no short name keeps the plain
// /admin. The pages are the same either way; only the address differs.

const ADMIN = '/admin';

/** The address of a department's admin home: /co/admin, or /admin without a short name. */
export function departmentAdminHome(urlCode?: string): string {
  return urlCode ? `/${urlCode}${ADMIN}` : ADMIN;
}

/** The address of a user's role dashboard based on role and department short code. */
export function departmentDashboardPath(urlCode?: string, role?: string): string {
  if (role === 'hod' || role === 'delegated_admin' || role === 'admin') {
    return urlCode ? `/${urlCode}/admin/dashboard` : '/admin/dashboard';
  }
  if (role === 'lecturer') {
    return '/l/dashboard';
  }
  return urlCode ? `/${urlCode}/i/dashboard` : '/i/dashboard';
}

/** The address of a user's role profile based on role and department short code. */
export function departmentProfilePath(urlCode?: string, role?: string): string {
  if (role === 'hod' || role === 'delegated_admin' || role === 'admin') {
    return urlCode ? `/${urlCode}/admin/profile` : '/admin/profile';
  }
  if (role === 'lecturer') {
    return '/l/profile';
  }
  return '/i/profile';
}

/**
 * Puts an admin path under the department's short name: /admin/results becomes
 * /co/admin/results. Paths outside the admin area, and every path when the
 * department has no short name, are returned unchanged.
 */
export function departmentAdminPath(urlCode: string | undefined, path: string): string {
  if (!urlCode || !isPlainAdminPath(path)) return path;
  return `/${urlCode}${path}`;
}

/** True for a plain /admin address (not yet under a department's short name). */
function isPlainAdminPath(path: string): boolean {
  return path === ADMIN || path.startsWith(`${ADMIN}/`);
}

/** True when the address is in the staff area, either plain (/admin) or under a short name (/co/admin). */
export function isAdminArea(pathname: string): boolean {
  return /^\/([a-z0-9]{2,12}\/)?admin(\/|$)/.test(pathname);
}
