import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '../types';

interface RoleState {
  availableRoles: UserRole[];
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  setAvailableRoles: (roles: UserRole[]) => void;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      availableRoles: ['student'],
      activeRole: 'student',
      setActiveRole: (role) => set({ activeRole: role }),
      setAvailableRoles: (roles) => set({ availableRoles: roles }),
      hasRole: (role) => get().availableRoles.includes(role),
      hasAnyRole: (roles) => roles.some((r) => get().availableRoles.includes(r)),
    }),
    { name: 'aces-roles' }
  )
);
