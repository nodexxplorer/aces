import type { UserRole } from '../types';

/**
 * What each role can do in the app. The roles listed for a capability are the
 * roles whose areas and actions it covers: the role areas in router.tsx, the
 * sidebars, and the server's role checks (internal/api/server.go). A person can
 * do everything their roles allow, so their permissions are the union over all
 * of their roles, including extra roles such as class_rep on a student.
 *
 * A delegated admin is different: they can only do the admin areas their HOD has
 * granted (see ADMIN_GRANTS). Each capability that an admin role covers names the
 * grant that controls it, and the server enforces the same grant.
 */
export type CapabilityGroup = 'Finance' | 'Academics' | 'Class' | 'Administration';

/** A per-person grant flag, named as the API names it. */
export type AdminGrantKey =
  | 'can_manage_results'
  | 'can_manage_users'
  | 'can_manage_finance'
  | 'can_manage_courses'
  | 'can_view_analytics'
  | 'can_manage_announcements'
  | 'can_backup_data'
  | 'can_manage_complaints'
  | 'can_manage_alumni'
  | 'can_manage_course_forms'
  | 'can_manage_settings';

export type AdminGrant = Partial<Record<AdminGrantKey, boolean>>;

/** The admin areas a HOD can grant, in the order the editor shows them. */
export const ADMIN_GRANTS: { key: AdminGrantKey; label: string; description: string }[] = [
  {
    key: 'can_manage_results',
    label: 'Results and grades',
    description: 'Enter, review and approve scores, assignments and CGPA rules.',
  },
  {
    key: 'can_manage_users',
    label: 'Users and roles',
    description: 'Manage users, staff, roles, approvals and profile requests.',
  },
  {
    key: 'can_manage_finance',
    label: 'Finance and payments',
    description: 'Dues, payments, receipts, expenses and graduation fees.',
  },
  {
    key: 'can_manage_courses',
    label: 'Courses and attendance',
    description: 'Courses, registrations, attendance and course materials.',
  },
  { key: 'can_view_analytics', label: 'Analytics and reports', description: 'Dashboards, reports and predictions.' },
  { key: 'can_manage_announcements', label: 'Announcements', description: 'Announcements, notices and help articles.' },
  { key: 'can_backup_data', label: 'Backups', description: 'Back up and restore data.' },
  {
    key: 'can_manage_complaints',
    label: 'Complaints and feedback',
    description: 'Complaints, feedback, campus reports and strikes.',
  },
  { key: 'can_manage_alumni', label: 'Alumni', description: 'Alumni status, mentorship, jobs, events and donations.' },
  {
    key: 'can_manage_course_forms',
    label: 'Course forms',
    description: 'Course form signing setup, history and signatures.',
  },
  {
    key: 'can_manage_settings',
    label: 'Sessions and settings',
    description: 'Sessions, semesters, rollover, calendar and feature flags.',
  },
];

export interface Capability {
  key: string;
  label: string;
  group: CapabilityGroup;
  roles: UserRole[];
  /** For a capability an admin role covers: the grant that allows it. */
  grant?: AdminGrantKey;
}

const ADMIN_ROLES: UserRole[] = ['hod', 'delegated_admin', 'admin'];
/** The roles that hold admin-tier access, and so need a grant. The HOD does not. */
const GRANT_HOLDER_ROLES: string[] = ['delegated_admin', 'admin'];
const BURSAR_ROLES: UserRole[] = ['class_bursar', 'dept_bursar'];

export const CAPABILITIES: Capability[] = [
  // Finance
  { key: 'pay_dues', label: 'Pay dues', group: 'Finance', roles: ['student'] },
  {
    key: 'view_payments',
    label: 'View payments and transactions',
    group: 'Finance',
    roles: [...BURSAR_ROLES, ...ADMIN_ROLES],
    grant: 'can_manage_finance',
  },
  {
    key: 'verify_payments',
    label: 'Verify payments',
    group: 'Finance',
    roles: [...BURSAR_ROLES, ...ADMIN_ROLES],
    grant: 'can_manage_finance',
  },
  {
    key: 'manage_dues',
    label: 'Create and edit dues',
    group: 'Finance',
    roles: [...BURSAR_ROLES, ...ADMIN_ROLES],
    grant: 'can_manage_finance',
  },
  {
    key: 'view_defaulters',
    label: 'View the defaulters list',
    group: 'Finance',
    roles: [...BURSAR_ROLES, 'hod', 'delegated_admin'],
    grant: 'can_manage_finance',
  },

  // Academics
  {
    key: 'enter_scores',
    label: 'Enter and review scores',
    group: 'Academics',
    roles: ['lecturer', ...ADMIN_ROLES],
    grant: 'can_manage_results',
  },
  { key: 'sign_course_forms', label: 'Sign own course forms', group: 'Academics', roles: ['student'] },
  {
    key: 'manage_course_forms',
    label: 'Set up course form signing',
    group: 'Academics',
    roles: ADMIN_ROLES,
    grant: 'can_manage_course_forms',
  },
  {
    key: 'manage_courses',
    label: 'Manage courses and sessions',
    group: 'Academics',
    roles: ADMIN_ROLES,
    grant: 'can_manage_courses',
  },

  // Class
  {
    key: 'view_class_list',
    label: 'View class lists',
    group: 'Class',
    roles: ['class_rep', 'lecturer', 'hod', 'delegated_admin'],
    grant: 'can_manage_courses',
  },
  {
    key: 'approve_registrations',
    label: 'Approve class registrations',
    group: 'Class',
    roles: ['class_rep', ...ADMIN_ROLES],
    grant: 'can_manage_courses',
  },
  {
    key: 'notify_classmates',
    label: 'Notify classmates',
    group: 'Class',
    roles: ['class_rep', 'hod', 'delegated_admin'],
    grant: 'can_manage_announcements',
  },

  // Administration
  {
    key: 'manage_users',
    label: 'Manage users',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_manage_users',
  },
  {
    key: 'assign_roles',
    label: 'Assign and remove roles',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_manage_users',
  },
  {
    key: 'view_role_log',
    label: 'View the role change log',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_manage_users',
  },
  {
    key: 'view_analytics',
    label: 'View analytics',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_view_analytics',
  },
  {
    key: 'post_announcements',
    label: 'Post announcements',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_manage_announcements',
  },
  {
    key: 'handle_complaints',
    label: 'Handle complaints',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_manage_complaints',
  },
  {
    key: 'manage_alumni',
    label: 'Manage alumni',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_manage_alumni',
  },
  {
    key: 'manage_settings',
    label: 'Manage sessions, semesters and settings',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_manage_settings',
  },
  {
    key: 'backup_data',
    label: 'Back up and restore data',
    group: 'Administration',
    roles: ADMIN_ROLES,
    grant: 'can_backup_data',
  },
];

/** The capabilities one role grants. */
export function capabilitiesForRole(role: string): Capability[] {
  return CAPABILITIES.filter((c) => c.roles.includes(role as UserRole));
}

/** The capabilities a person has, ignoring grants: the union over all of their roles. */
export function capabilitiesForRoles(roles: readonly string[]): Capability[] {
  return CAPABILITIES.filter((c) => roles.some((r) => c.roles.includes(r as UserRole)));
}

/**
 * What a person can actually do. The HOD is not subject to grants. A delegated
 * admin gets an admin-tier capability only when the grant that controls it is on.
 * Everything else comes from the non-admin roles the person holds.
 */
export function capabilitiesForPerson(roles: readonly string[], grant: AdminGrant | null): Capability[] {
  if (roles.includes('hod')) return capabilitiesForRoles(roles);
  const holdsAdminRole = roles.some((r) => GRANT_HOLDER_ROLES.includes(r));
  const otherRoles = roles.filter((r) => !GRANT_HOLDER_ROLES.includes(r));
  return CAPABILITIES.filter((c) => {
    if (c.roles.some((r) => otherRoles.includes(r))) return true;
    return holdsAdminRole && c.grant !== undefined && grant?.[c.grant] === true;
  });
}
