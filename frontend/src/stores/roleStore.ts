import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '../types';

interface RoleState {
  availableRoles: UserRole[];
  setAvailableRoles: (roles: UserRole[]) => void;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      availableRoles: ['student'],
      setAvailableRoles: (roles) => set({ availableRoles: roles }),
      hasRole: (role) => get().availableRoles.includes(role),
      hasAnyRole: (roles) => roles.some((r) => get().availableRoles.includes(r)),
    }),
    { name: 'aces-roles' }
  )
);
