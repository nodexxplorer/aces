import { useEffect } from 'react';
import { useThemeStore } from '../stores/themeStore';

export const useDarkMode = () => {
  const { mode, setMode, toggle, isDark } = useThemeStore();

  useEffect(() => {
    const resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    document.documentElement.classList.toggle('dark', resolved === 'dark');

    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [mode]);

  return { mode, setMode, toggle, isDark: isDark() };
};
