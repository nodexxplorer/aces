import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from './colors';

const ThemeContext = createContext<{ theme: Theme; isDark: boolean }>({
  theme: lightTheme,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const value = useMemo(() => ({ theme: isDark ? darkTheme : lightTheme, isDark }), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
