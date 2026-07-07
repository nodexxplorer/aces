import { useRoleStore } from '../stores/roleStore';
import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types';

export const useRBAC = () => {
  const { hasRole, hasAnyRole } = useRoleStore();
  const activeRole = useAuthStore((s) => s.user?.activeRole ?? 'student');

  const isAdmin = hasAnyRole(['hod', 'delegated_admin']);
  const isStaff = hasAnyRole(['hod', 'delegated_admin', 'lecturer']);
  const isStudent = hasRole('student');
  const isAlumni = hasRole('alumni');
  const isBursar = hasAnyRole(['class_bursar', 'dept_bursar']);
  const isClassRep = hasRole('class_rep');

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
