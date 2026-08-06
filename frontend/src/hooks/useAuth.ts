import { useAuthStore } from '../stores/authStore';
import { useRoleStore } from '../stores/roleStore';
import { logout as apiLogout, getMe } from '../api/auth';
import type { UserRole, User, AuthTokens } from '../types';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, login, logout, updateUser, switchRole } = useAuthStore();
  const { availableRoles, setAvailableRoles } = useRoleStore();

  const activeRole = user?.activeRole ?? 'student';

  const handleLogin = (userData: User, tokens: AuthTokens) => {
    login(userData, tokens);
    setAvailableRoles(userData.roles || ['student']);
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
      // The backend has no concept of a "currently active" role — it always
      // reports the account's primary role. Preserve whatever role the user
      // has locally switched to (as long as they still hold it), otherwise
      // every refresh would silently bounce a switched class-rep/bursar user
      // back to their primary role's dashboard.
      const currentActiveRole = useAuthStore.getState().user?.activeRole;
      const roles = latestUser.roles || ['student'];
      const preservedActiveRole =
        currentActiveRole && roles.includes(currentActiveRole) ? currentActiveRole : latestUser.activeRole;
      updateUser({ ...latestUser, activeRole: preservedActiveRole });
      if (latestUser.roles) {
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
