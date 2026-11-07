import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, UserRole } from '../types';
import { clearPendingActions, invalidateCache } from '../db/offlineDb';
import { queryClient } from '../query/client';

let sessionRevision = 0;
export const getSessionRevision = () => sessionRevision;

function resetPrivateSession() {
  sessionRevision += 1;
  // Clear synchronously as well as cancelling in-flight query work.
  void queryClient.cancelQueries();
  queryClient.clear();
  void invalidateCache();
  void clearPendingActions();
}

export const cacheOwner = (user: User | null) =>
  user ? JSON.stringify([user.tenant?.slug ?? '', user.id, user.activeRole]) : null;

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
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,
      _hasHydrated: false,
      setUser: (user) => {
        if (cacheOwner(get().user) !== cacheOwner(user)) resetPrivateSession();
        set({ user });
      },
      setTokens: (tokens) => {
        set({ tokens });
      },
      login: (user, tokens) => {
        resetPrivateSession();
        set({ user, tokens, isAuthenticated: true, isLoading: false });
      },
      logout: () => {
        resetPrivateSession();
        set({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
      },
      updateUser: (partial) => {
        const user = get().user ? { ...get().user!, ...partial } : null;
        if (cacheOwner(get().user) !== cacheOwner(user)) resetPrivateSession();
        set({ user });
      },
      switchRole: (role) => {
        if (get().user?.activeRole !== role) resetPrivateSession();
        set((state) => ({ user: state.user ? { ...state.user, activeRole: role } : null }));
      },
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
    },
  ),
);

// Ensure hydration is triggered
if (typeof window !== 'undefined') {
  useAuthStore.persist.rehydrate();
}
