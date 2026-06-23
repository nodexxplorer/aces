import { useAuthStore } from '../stores/authStore';
import { useRoleStore } from '../stores/roleStore';
import type { UserRole } from '../types';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, login, logout, updateUser, switchRole } = useAuthStore();
  const { availableRoles, activeRole, setActiveRole, setAvailableRoles } = useRoleStore();

  const handleLogin = (userData: Parameters<typeof login>[0], tokens: Parameters<typeof login>[1]) => {
    login(userData, tokens);
    setAvailableRoles(userData.roles);
    setActiveRole(userData.activeRole);
  };

  const handleSwitchRole = (role: UserRole) => {
    switchRole(role);
    setActiveRole(role);
  };

  const handleLogout = () => {
    logout();
    setAvailableRoles(['student']);
    setActiveRole('student');
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    availableRoles,
    activeRole,
    login: handleLogin,
    logout: handleLogout,
    updateUser,
    switchRole: handleSwitchRole,
  };
};
