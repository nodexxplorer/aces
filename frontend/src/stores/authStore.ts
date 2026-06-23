import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, UserRole } from '../types';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User) => void;
  setTokens: (tokens: AuthTokens) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  switchRole: (role: UserRole) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user }),
      setTokens: (tokens) => {
        if (tokens) {
          localStorage.setItem('aces_access_token', tokens.accessToken);
          localStorage.setItem('aces_refresh_token', tokens.refreshToken);
        }
        set({ tokens });
      },
      login: (user, tokens) => {
        localStorage.setItem('aces_access_token', tokens.accessToken);
        localStorage.setItem('aces_refresh_token', tokens.refreshToken);
        set({ user, tokens, isAuthenticated: true, isLoading: false });
      },
      logout: () => {
        localStorage.removeItem('aces_access_token');
        localStorage.removeItem('aces_refresh_token');
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
    }),
    {
      name: 'aces-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
