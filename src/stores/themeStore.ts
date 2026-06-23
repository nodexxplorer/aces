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
        document.documentElement.classList.toggle('dark', resolved === 'dark');
        set({ mode });
      },
      toggle: () => {
        const current = get().mode;
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', next === 'dark');
        set({ mode: next });
      },
      isDark: () => {
        const m = get().mode;
        return m === 'dark' || (m === 'system' && getSystemTheme() === 'dark');
      },
    }),
    { name: 'aces-theme' }
  )
);
