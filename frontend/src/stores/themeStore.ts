import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '../types';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  isDark: () => boolean;
}

const getSystemTheme = (): 'light' | 'dark' =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => {
        const resolved = mode === 'system' ? getSystemTheme() : mode;
        const isDark = resolved === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        set({ mode });
      },
      toggle: () => {
        const current = get().mode;
        const next = current === 'dark' ? 'light' : 'dark';
        const isDark = next === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        set({ mode: next });
      },
      isDark: () => {
        const m = get().mode;
        return m === 'dark' || (m === 'system' && getSystemTheme() === 'dark');
      },
    }),
    { name: 'aces-theme' },
  ),
);
