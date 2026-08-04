// Dark-first palette proposed for Leia Manga; no official brand assets exist yet.
export const palette = {
  dark: {
    background: '#0E0F13',
    surface: '#181A20',
    surfaceAlt: '#22242C',
    border: '#2C2F38',
    text: '#F2F3F5',
    textMuted: '#9AA0AC',
    accent: '#7C5CFF',
    accentMuted: '#5A3FCC',
    danger: '#FF5C5C',
    tabIconDefault: '#5C6270',
    overlay: 'rgba(0,0,0,0.55)',
  },
  light: {
    background: '#F7F7FA',
    surface: '#FFFFFF',
    surfaceAlt: '#EFEFF4',
    border: '#E1E2E8',
    text: '#15161A',
    textMuted: '#63697A',
    accent: '#6A4CE0',
    accentMuted: '#DCD3FA',
    danger: '#D8383B',
    tabIconDefault: '#9096A3',
    overlay: 'rgba(0,0,0,0.55)',
  },
} as const;

export type ThemeName = keyof typeof palette;
export type ThemeColors = { [K in keyof (typeof palette)['dark']]: string };
