import { useEffect } from 'react';
import { useThemeStore } from '../stores/themeStore';

const ThemeInitializer = ({ children }: { children: React.ReactNode }) => {
  const setMode = useThemeStore((s) => s.setMode);

  useEffect(() => {
    const saved = useThemeStore.getState().mode;
    const resolved =
      saved === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : saved;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.setAttribute('data-theme', resolved === 'dark' ? 'dark' : 'light');

    if (saved === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        const isDark = e.matches;
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [setMode]);

  return <>{children}</>;
};

export default ThemeInitializer;
