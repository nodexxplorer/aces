import type { UserRole } from '../types';

/**
 * What each role can do in the app. The roles listed for a capability are the
 * roles whose areas and actions it covers: the role areas in router.tsx, the
 * sidebars, and the server's role checks (internal/api/server.go). A person can
 * do everything their roles allow, so their permissions are the union over all
 * of their roles, including extra roles such as class_rep on a student.
 */
export type CapabilityGroup = 'Finance' | 'Academics' | 'Class' | 'Administration';

export interface Capability {
  key: string;
  label: string;
  group: CapabilityGroup;
  roles: UserRole[];
}

const ADMIN_ROLES: UserRole[] = ['hod', 'delegated_admin', 'admin'];
const BURSAR_ROLES: UserRole[] = ['class_bursar', 'dept_bursar'];

export const CAPABILITIES: Capability[] = [
  // Finance
  { key: 'pay_dues', label: 'Pay dues', group: 'Finance', roles: ['student'] },
  {
    key: 'view_payments',
    label: 'View payments and transactions',
    group: 'Finance',
    roles: [...BURSAR_ROLES, ...ADMIN_ROLES],
  },
  { key: 'verify_payments', label: 'Verify payments', group: 'Finance', roles: [...BURSAR_ROLES, ...ADMIN_ROLES] },
  { key: 'manage_dues', label: 'Create and edit dues', group: 'Finance', roles: [...BURSAR_ROLES, ...ADMIN_ROLES] },
  {
    key: 'view_defaulters',
    label: 'View the defaulters list',
    group: 'Finance',
    roles: [...BURSAR_ROLES, 'hod', 'delegated_admin'],
  },

  // Academics
  { key: 'enter_scores', label: 'Enter and review scores', group: 'Academics', roles: ['lecturer', ...ADMIN_ROLES] },
  { key: 'sign_course_forms', label: 'Sign own course forms', group: 'Academics', roles: ['student'] },
  { key: 'manage_course_forms', label: 'Set up course form signing', group: 'Academics', roles: ADMIN_ROLES },
  { key: 'manage_courses', label: 'Manage courses and sessions', group: 'Academics', roles: ADMIN_ROLES },

  // Class
  {
    key: 'view_class_list',
    label: 'View class lists',
    group: 'Class',
    roles: ['class_rep', 'lecturer', 'hod', 'delegated_admin'],
  },
  {
    key: 'approve_registrations',
    label: 'Approve class registrations',
    group: 'Class',
    roles: ['class_rep', ...ADMIN_ROLES],
  },
  {
    key: 'notify_classmates',
    label: 'Notify classmates',
    group: 'Class',
    roles: ['class_rep', 'hod', 'delegated_admin'],
  },

  // Administration
  { key: 'manage_users', label: 'Manage users', group: 'Administration', roles: ADMIN_ROLES },
  { key: 'assign_roles', label: 'Assign and remove roles', group: 'Administration', roles: ADMIN_ROLES },
  { key: 'view_role_log', label: 'View the role change log', group: 'Administration', roles: ADMIN_ROLES },
  { key: 'view_analytics', label: 'View analytics', group: 'Administration', roles: ADMIN_ROLES },
  { key: 'post_announcements', label: 'Post announcements', group: 'Administration', roles: ADMIN_ROLES },
  { key: 'handle_complaints', label: 'Handle complaints', group: 'Administration', roles: ADMIN_ROLES },
];

/** The capabilities one role grants. */
export function capabilitiesForRole(role: string): Capability[] {
  return CAPABILITIES.filter((c) => c.roles.includes(role as UserRole));
}

/** The capabilities a person has: the union over all of their roles. */
export function capabilitiesForRoles(roles: readonly string[]): Capability[] {
  return CAPABILITIES.filter((c) => roles.some((r) => c.roles.includes(r as UserRole)));
}
