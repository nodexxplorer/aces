import { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from './colors';
import { useSettingsStore, FONT_SCALE_VALUES } from '../store/settingsStore';

const ThemeContext = createContext<{ theme: Theme; isDark: boolean; fontScale: number }>({
  theme: lightTheme,
  isDark: false,
  fontScale: 1,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const fontScaleKey = useSettingsStore((s) => s.fontScale);
  const isHydrated = useSettingsStore((s) => s.isHydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  // 'system' defers to the OS setting; an explicit 'light'/'dark' choice
  // from Settings overrides it regardless of what the device is set to.
  const isDark = themeMode === 'system' ? scheme === 'dark' : themeMode === 'dark';
  const fontScale = FONT_SCALE_VALUES[fontScaleKey];

  const value = useMemo(
    () => ({ theme: isDark ? darkTheme : lightTheme, isDark, fontScale }),
    [isDark, fontScale],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
