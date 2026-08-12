import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type FontScaleKey = 'small' | 'default' | 'large' | 'xlarge';

export const FONT_SCALE_VALUES: Record<FontScaleKey, number> = {
  small: 0.9,
  default: 1,
  large: 1.15,
  xlarge: 1.3,
};

export const FONT_SCALE_LABELS: Record<FontScaleKey, string> = {
  small: 'Small',
  default: 'Default',
  large: 'Large',
  xlarge: 'Extra Large',
};

const SETTINGS_KEY = 'aces_settings_v1';

interface PersistedSettings {
  themeMode: ThemeMode;
  fontScale: FontScaleKey;
  biometricEnabled: boolean;
}

interface SettingsState extends PersistedSettings {
  isHydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setFontScale: (scale: FontScaleKey) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  hydrate: () => Promise<void>;
}

function persist(state: PersistedSettings) {
  AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(state)).catch(() => {});
}

// App preferences (theme, text size, biometric opt-in) — plain AsyncStorage,
// not secureStorage: these are just UI settings, not secrets, and
// AsyncStorage (unlike expo-secure-store) also works on web for dev checks.
export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: 'system',
  fontScale: 'default',
  biometricEnabled: false,
  isHydrated: false,

  setThemeMode: (themeMode) => {
    set({ themeMode });
    persist({ themeMode, fontScale: get().fontScale, biometricEnabled: get().biometricEnabled });
  },
  setFontScale: (fontScale) => {
    set({ fontScale });
    persist({ themeMode: get().themeMode, fontScale, biometricEnabled: get().biometricEnabled });
  },
  setBiometricEnabled: (biometricEnabled) => {
    set({ biometricEnabled });
    persist({ themeMode: get().themeMode, fontScale: get().fontScale, biometricEnabled });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
        set({
          themeMode: parsed.themeMode ?? 'system',
          fontScale: parsed.fontScale ?? 'default',
          biometricEnabled: parsed.biometricEnabled ?? false,
        });
      }
    } finally {
      set({ isHydrated: true });
    }
  },
}));
