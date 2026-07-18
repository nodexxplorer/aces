import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, UserRole } from '../types';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;
  setUser: (user: User) => void;
  setTokens: (tokens: AuthTokens) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  switchRole: (role: UserRole) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,
      _hasHydrated: false,
      setUser: (user) => set({ user }),
      setTokens: (tokens) => {
        set({ tokens });
      },
      login: (user, tokens) => {
        set({ user, tokens, isAuthenticated: true, isLoading: false });
      },
      logout: () => {
        set({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
      },
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
      switchRole: (role) =>
        set((state) => ({
          user: state.user ? { ...state.user, activeRole: role } : null,
        })),
      setLoading: (loading) => set({ isLoading: loading }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'aces-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (!error) {
          // Mark hydration as complete
          useAuthStore.getState().setHasHydrated(true);
        } else {
          // Even on error, mark as hydrated to avoid indefinite loading
          useAuthStore.getState().setHasHydrated(true);
        }
      },
    }
  )
);

// Ensure hydration is triggered
if (typeof window !== 'undefined') {
  useAuthStore.persist.rehydrate();
}
