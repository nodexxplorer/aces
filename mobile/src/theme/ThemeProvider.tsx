import { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, palette, themeFor, type Brand, type Theme } from './colors';
import { useSettingsStore, FONT_SCALE_VALUES } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

export interface ThemeValue {
  theme: Theme;
  /** The primary colour ramp: the platform blue, or the department's accent. Use it for gradients. */
  brand: Brand;
  isDark: boolean;
  fontScale: number;
}

const ThemeContext = createContext<ThemeValue>({
  theme: lightTheme,
  brand: palette.primary,
  isDark: false,
  fontScale: 1,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const fontScaleKey = useSettingsStore((s) => s.fontScale);
  const isHydrated = useSettingsStore((s) => s.isHydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);
  // The signed-in user's department. Sign-in and sign-up show their own department
  // through AccentScope, and the platform blue applies before anyone has chosen one.
  const accent = useAuthStore((s) => s.user?.tenant?.accentColor);

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  // 'system' defers to the OS setting; an explicit 'light'/'dark' choice
  // from Settings overrides it regardless of what the device is set to.
  const isDark = themeMode === 'system' ? scheme === 'dark' : themeMode === 'dark';
  const fontScale = FONT_SCALE_VALUES[fontScaleKey];

  const value = useMemo<ThemeValue>(
    () => ({ ...themeFor(isDark, accent), isDark, fontScale }),
    [isDark, fontScale, accent],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Gives the screens below it one department's colours. The sign-in and sign-up
 * screens use it, because they show a department before anyone has signed in.
 * Pass null or undefined for the platform colours.
 */
export function AccentScope({ accent, children }: { accent: string | null | undefined; children: React.ReactNode }) {
  const outer = useTheme();
  const value = useMemo<ThemeValue>(() => ({ ...outer, ...themeFor(outer.isDark, accent) }), [outer, accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
