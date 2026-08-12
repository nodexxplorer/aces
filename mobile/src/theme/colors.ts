// Mirrors the web app's Tailwind palette (frontend/tailwind.config.*) so the
// mobile app reads as the same product, not a reskin.

export const palette = {
  primary: {
    50: '#e6f0ff',
    100: '#b3d1ff',
    200: '#80b3ff',
    300: '#4d94ff',
    400: '#1a75ff',
    500: '#0066CC',
    600: '#0052a3',
    700: '#003d7a',
    800: '#002952',
    900: '#003366',
    950: '#001a33',
  },
  accent: {
    50: '#e6f7ff',
    100: '#b3e5ff',
    200: '#80d4ff',
    300: '#4dc3ff',
    400: '#1ab2ff',
    500: '#00AAFF',
    600: '#0088cc',
    700: '#006699',
    800: '#004466',
    900: '#002233',
  },
  surface: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  success: { 50: '#ecfdf5', 500: '#10b981', 600: '#059669', 700: '#047857' },
  warning: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706' },
  danger: { 50: '#fff1f2', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
  white: '#ffffff',
  black: '#000000',
} as const;

export interface Theme {
  background: string;
  backgroundElevated: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  accent: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  divider: string;
  overlay: string;
  statusBar: 'dark' | 'light';
}

// Semantic tokens — every screen should read from these, never from
// `palette` directly, so light/dark switches by changing one object.
export const lightTheme: Theme = {
  background: palette.surface[50],
  backgroundElevated: palette.white,
  card: palette.white,
  cardBorder: palette.surface[200],
  text: palette.surface[900],
  textMuted: palette.surface[500],
  textFaint: palette.surface[400],
  primary: palette.primary[500],
  primaryMuted: palette.primary[50],
  onPrimary: palette.white,
  accent: palette.accent[500],
  success: palette.success[600],
  successMuted: palette.success[50],
  warning: palette.warning[600],
  warningMuted: palette.warning[50],
  danger: palette.danger[600],
  dangerMuted: palette.danger[50],
  divider: palette.surface[200],
  overlay: 'rgba(15, 23, 42, 0.45)',
  statusBar: 'dark',
};

export const darkTheme: Theme = {
  background: palette.surface[950],
  backgroundElevated: palette.surface[900],
  card: palette.surface[900],
  cardBorder: palette.surface[800],
  text: palette.surface[50],
  textMuted: palette.surface[400],
  textFaint: palette.surface[600],
  primary: palette.primary[400],
  primaryMuted: 'rgba(0, 102, 204, 0.16)',
  onPrimary: palette.white,
  accent: palette.accent[400],
  success: palette.success[500],
  successMuted: 'rgba(16, 185, 129, 0.12)',
  warning: palette.warning[500],
  warningMuted: 'rgba(245, 158, 11, 0.12)',
  danger: palette.danger[500],
  dangerMuted: 'rgba(244, 63, 94, 0.12)',
  divider: palette.surface[800],
  overlay: 'rgba(0, 0, 0, 0.6)',
  statusBar: 'light',
};
