import { create } from 'zustand';
import { getItem, setItem, deleteItem } from '../utils/secureStorage';

// Mirrors the web app's User/AuthTokens shape (frontend/src/types) closely
// enough to share mental model, trimmed to what the mobile v1 screens use.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  role: string;
  activeRole: string;
  roles: string[];
  matricNumber?: string;
  level?: number;
  onboardingCompleted: boolean;
  phone?: string;
  homeAddress?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  isApproved?: boolean;
  isActive?: boolean;
}

const ACCESS_TOKEN_KEY = 'aces_access_token';
const REFRESH_TOKEN_KEY = 'aces_refresh_token';
const USER_KEY = 'aces_user';

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (user: AuthUser, tokens: AuthTokens) => Promise<void>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: AuthUser) => void;
  switchRole: (role: string) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

// expo-secure-store (Keychain/Keystore-backed) rather than AsyncStorage —
// these are auth tokens, not app preferences.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isHydrated: false,

  login: async (user, tokens) => {
    await Promise.all([
      setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
      setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
      setItem(USER_KEY, JSON.stringify(user)),
    ]);
    set({ user, tokens, isAuthenticated: true });
  },

  setTokens: async (tokens) => {
    await Promise.all([
      setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
      setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
    set({ tokens });
  },

  setUser: (user) => {
    setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
    set({ user });
  },

  // Mirrors the web app's RoleSwitcher (frontend/src/components/ui/RoleSwitcher.tsx)
  // — a user can hold multiple roles (e.g. student + class_rep) simultaneously;
  // this only changes which one is "active" client-side, same as web. No
  // backend call needed since /auth/me already returns the full roles list.
  switchRole: (role) => {
    set((state) => {
      if (!state.user || !state.user.roles.includes(role)) return state;
      const nextUser = { ...state.user, activeRole: role };
      setItem(USER_KEY, JSON.stringify(nextUser)).catch(() => {});
      return { user: nextUser };
    });
  },

  logout: async () => {
    await Promise.all([
      deleteItem(ACCESS_TOKEN_KEY),
      deleteItem(REFRESH_TOKEN_KEY),
      deleteItem(USER_KEY),
    ]);
    set({ user: null, tokens: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        getItem(ACCESS_TOKEN_KEY),
        getItem(REFRESH_TOKEN_KEY),
        getItem(USER_KEY),
      ]);
      if (accessToken && refreshToken && userJson) {
        set({
          user: JSON.parse(userJson),
          tokens: { accessToken, refreshToken, expiresAt: '' },
          isAuthenticated: true,
        });
      }
    } finally {
      set({ isHydrated: true });
    }
  },
}));

export async function getStoredAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_TOKEN_KEY);
}
