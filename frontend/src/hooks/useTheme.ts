import { useDarkMode } from './useDarkMode';

export const useTheme = () => {
  const { mode, toggle } = useDarkMode();
  return {
    theme: mode,
    toggleTheme: toggle,
  };
};
