import { create } from 'zustand';

import { getSetting, setSetting } from '@/src/db/repository';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => void;
}

const KEY = 'appearance.themePreference';

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await getSetting(KEY);
    set({
      preference: stored === 'light' || stored === 'dark' ? stored : 'system',
      hydrated: true,
    });
  },
  setPreference: (preference) => {
    set({ preference });
    void setSetting(KEY, preference);
  },
}));
