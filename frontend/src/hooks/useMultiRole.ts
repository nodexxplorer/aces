import { useRoleStore } from '../stores/roleStore';
import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types';

export const useMultiRole = () => {
  const { availableRoles, activeRole, setActiveRole } = useRoleStore();
  const switchRole = useAuthStore((s) => s.switchRole);

  const handleSwitch = (role: UserRole) => {
    if (availableRoles.includes(role)) {
      setActiveRole(role);
      switchRole(role);
    }
  };

  const hasMultipleRoles = availableRoles.length > 1;

  return { availableRoles, activeRole, switchRole: handleSwitch, hasMultipleRoles };
};
