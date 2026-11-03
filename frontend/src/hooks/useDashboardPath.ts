import { useAuthStore } from '../stores/authStore';
import { departmentDashboardPath, departmentProfilePath } from '../config/departmentAdminPaths';

/**
 * Returns the role- and department-prefixed dashboard path for the current user.
 * e.g. /co/admin/dashboard for Admin, /l/dashboard for Lecturer, /co/i/dashboard for Student.
 */
export function useDashboardPath(): string {
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);
  const role = useAuthStore((s) => s.user?.activeRole || s.user?.role);
  return departmentDashboardPath(urlCode, role);
}

/**
 * Returns the role-prefixed profile path for the current user.
 * e.g. /admin/profile for Admin, /l/profile for Lecturer, /i/profile for Student.
 */
export function useProfilePath(): string {
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);
  const role = useAuthStore((s) => s.user?.activeRole || s.user?.role);
  return departmentProfilePath(urlCode, role);
}
