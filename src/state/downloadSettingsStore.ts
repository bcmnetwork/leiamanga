/**
 * Persisted user preference controlling whether chapter downloads are
 * restricted to Wi-Fi connections. When enabled, the download queue pauses
 * automatically while on cellular data and resumes as soon as Wi-Fi becomes
 * available again (see `src/state/downloadQueueStore.ts`).
 */
import { create } from 'zustand';

import { getSetting, setSetting } from '@/src/db/repository';

const KEY = 'downloads.wifiOnly';

interface DownloadSettingsState {
  wifiOnly: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setWifiOnly: (value: boolean) => void;
}

export const useDownloadSettingsStore = create<DownloadSettingsState>((set, get) => ({
  wifiOnly: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const raw = await getSetting(KEY);
    set({ wifiOnly: raw === 'true', hydrated: true });
  },

  setWifiOnly: (value) => {
    set({ wifiOnly: value });
    void setSetting(KEY, value ? 'true' : 'false');
  },
}));
