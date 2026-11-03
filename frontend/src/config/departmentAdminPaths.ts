// Role addresses. Every signed-in page lives under its department's short
// name, and then under the role's segment:
//   /co/admin/...  admin (HOD, delegated admin, admin)
//   /co/i/...      student
//   /co/l/...      lecturer
//   /co/rep/...    class rep
//   /co/bu/...     bursar
// Code refers to pages with the role segment only (/i/payments); tenantPath
// adds the department's short name in front of it.

/** The role segments a page address can start with. */
export const ROLE_SEGMENTS = ['admin', 'i', 'l', 'rep', 'bu'] as const;
export type RoleSegment = (typeof ROLE_SEGMENTS)[number];

const ADMIN_ROLES = ['hod', 'delegated_admin', 'admin'];
const BURSAR_ROLES = ['class_bursar', 'dept_bursar'];

/** The role segment for a role: the area its pages live in. */
export function roleSegment(role?: string): RoleSegment {
  if (role && ADMIN_ROLES.includes(role)) return 'admin';
  if (role === 'lecturer') return 'l';
  if (role === 'class_rep') return 'rep';
  if (role && BURSAR_ROLES.includes(role)) return 'bu';
  return 'i';
}

/**
 * Puts a role-relative path under the department's short name: /i/payments
 * becomes /co/i/payments. Paths outside the role areas (/notifications, /connect)
 * are returned unchanged, and so is every path when the department has no short name.
 */
export function tenantPath(urlCode: string | undefined, path: string): string {
  if (!urlCode || !isRolePath(path)) return path;
  return `/${urlCode}${path}`;
}

/** True for an address inside one of the role areas, with or without a short name. */
export function isRolePath(path: string): boolean {
  return ROLE_SEGMENTS.some(
    (segment) => path === `/${segment}` || path.startsWith(`/${segment}/`) || path.startsWith(`/${segment}?`),
  );
}

/** The address of a department's admin home: /co/admin, or /admin without a short name. */
export function departmentAdminHome(urlCode?: string): string {
  return tenantPath(urlCode, '/admin');
}

/** The address of a user's role dashboard, e.g. /co/admin/dashboard or /co/rep/dashboard. */
export function departmentDashboardPath(urlCode?: string, role?: string): string {
  return tenantPath(urlCode, `/${roleSegment(role)}/dashboard`);
}

/** The address of a user's role profile. Lecturers and admins have their own; everyone else uses the student profile. */
export function departmentProfilePath(urlCode?: string, role?: string): string {
  const segment = roleSegment(role);
  if (segment === 'admin') return tenantPath(urlCode, '/admin/profile');
  if (segment === 'l') return tenantPath(urlCode, '/l/profile');
  return tenantPath(urlCode, '/i/profile');
}

/** Same as tenantPath, kept under its earlier name for the existing callers. */
export const departmentAdminPath = tenantPath;

/** True when the address is in the staff area, either plain (/admin) or under a short name (/co/admin). */
export function isAdminArea(pathname: string): boolean {
  return /^\/([a-z0-9]{2,12}\/)?admin(\/|$)/.test(pathname);
}
