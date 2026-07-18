import { useAuthStore } from '../stores/authStore';
import { useRoleStore } from '../stores/roleStore';
import { logout as apiLogout } from '../api/auth';
import type { UserRole } from '../types';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, login, logout, updateUser, switchRole } = useAuthStore();
  const { availableRoles, setAvailableRoles } = useRoleStore();

  const activeRole = user?.activeRole ?? 'student';

  const handleLogin = (userData: Parameters<typeof login>[0], tokens: Parameters<typeof login>[1]) => {
    login(userData, tokens);
    setAvailableRoles(userData.roles);
  };

  const handleSwitchRole = (role: UserRole) => {
    switchRole(role);
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // Logout even if server call fails
    }
    logout();
    setAvailableRoles(['student']);
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
