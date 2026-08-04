import { useColorScheme } from '@/components/useColorScheme';

import { palette, ThemeColors, ThemeName } from './colors';

export function useAppTheme(): { name: ThemeName; colors: ThemeColors } {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === 'light' ? 'light' : 'dark';
  return { name, colors: palette[name] };
}

export { palette };
export type { ThemeColors, ThemeName };

