import { useColorScheme } from '@/components/useColorScheme';
import { useThemeStore } from '@/src/state/themeStore';

import { palette, ThemeColors, ThemeName } from './colors';

export function useAppTheme(): { name: ThemeName; colors: ThemeColors } {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const scheme = preference === 'system' ? systemScheme : preference;
  const name: ThemeName = scheme === 'light' ? 'light' : 'dark';
  return { name, colors: palette[name] };
}

export { palette };
export type { ThemeColors, ThemeName };

