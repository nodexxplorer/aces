import { useAuthStore } from '../stores/authStore';
import { useRoleStore } from '../stores/roleStore';
import { logout as apiLogout, getMe } from '../api/auth';
import type { UserRole } from '../types';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, login, logout, updateUser, switchRole } = useAuthStore();
  const { availableRoles, setAvailableRoles } = useRoleStore();

  const activeRole = user?.activeRole ?? 'student';

  const handleLogin = (userData: any, tokens: any) => {
    login(userData, tokens);
    setAvailableRoles(userData.allRoles || userData.roles || ['student']);
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

  const refreshUser = async () => {
    try {
      const latestUser = await getMe();
      updateUser(latestUser);
      if (latestUser.allRoles) {
        setAvailableRoles(latestUser.allRoles);
      } else if (latestUser.roles) {
        setAvailableRoles(latestUser.roles);
      }
    } catch (err) {
      console.error('Failed to refresh user info', err);
    }
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
    refreshUser,
  };
};
