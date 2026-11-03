import { useEffect } from 'react';
import { useThemeStore } from '../stores/themeStore';

export const useDarkMode = () => {
  const { mode, setMode, toggle, isDark } = useThemeStore();

  useEffect(() => {
    const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
    const resolved =
      mode === 'system'
        ? hasMatchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode;
    const isDark = resolved === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    if (mode === 'system' && hasMatchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        const sysDark = e.matches;
        document.documentElement.classList.toggle('dark', sysDark);
        document.documentElement.setAttribute('data-theme', sysDark ? 'dark' : 'light');
      };
      mediaQuery.addEventListener?.('change', handler);
      return () => mediaQuery.removeEventListener?.('change', handler);
    }
  }, [mode]);

  return { mode, setMode, toggle, isDark: isDark() };
};
