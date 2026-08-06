import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types';

export const useRBAC = () => {
  const activeRole = useAuthStore((s) => s.user?.activeRole ?? 'student');

  // These must key off the currently active role, not every role the user
  // has ever held (roleStore.availableRoles) — otherwise a multi-role user
  // stays flagged as e.g. isAdmin after switching to a non-admin role.
  const isAdmin = (['hod', 'delegated_admin', 'admin'] as UserRole[]).includes(activeRole);
  const isStaff = (['hod', 'delegated_admin', 'lecturer'] as UserRole[]).includes(activeRole);
  const isStudent = activeRole === 'student';
  const isAlumni = activeRole === 'alumni';
  const isBursar = (['class_bursar', 'dept_bursar'] as UserRole[]).includes(activeRole);
  const isClassRep = activeRole === 'class_rep';

  const canAccess = (allowedRoles: UserRole[]): boolean => {
    if (allowedRoles.length === 0) return true;
    return allowedRoles.includes(activeRole);
  };

  const canManageResults = isAdmin || activeRole === 'lecturer';
  const canManagePayments = isAdmin || isBursar;
  const canManageUsers = isAdmin;
  const canApproveStudents = isAdmin || isClassRep;
  const canPostJobs = isAlumni || isStudent;

  return {
    activeRole,
    isAdmin,
    isStaff,
    isStudent,
    isAlumni,
    isBursar,
    isClassRep,
    canAccess,
    canManageResults,
    canManagePayments,
    canManageUsers,
    canApproveStudents,
    canPostJobs,
  };
};
