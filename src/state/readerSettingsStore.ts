import { create } from 'zustand';

import { getSetting, setSetting } from '@/src/db/repository';

export type ReadingMode = 'single' | 'vertical';
export type ReadingDirection = 'ltr' | 'rtl';
export type OrientationLock = 'auto' | 'portrait' | 'landscape';

interface ReaderSettingsState {
  mode: ReadingMode;
  direction: ReadingDirection;
  brightnessOverlay: number; // 0 (no dimming) to 1 (fully dark)
  keepAwake: boolean;
  orientationLock: OrientationLock;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: ReadingMode) => void;
  setDirection: (direction: ReadingDirection) => void;
  setBrightnessOverlay: (value: number) => void;
  setKeepAwake: (value: boolean) => void;
  setOrientationLock: (value: OrientationLock) => void;
}

const KEYS = {
  mode: 'reader.mode',
  direction: 'reader.direction',
  brightness: 'reader.brightnessOverlay',
  keepAwake: 'reader.keepAwake',
  orientationLock: 'reader.orientationLock',
} as const;

export const useReaderSettingsStore = create<ReaderSettingsState>((set, get) => ({
  mode: 'single',
  direction: 'rtl',
  brightnessOverlay: 0,
  keepAwake: true,
  orientationLock: 'portrait',
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    const [mode, direction, brightness, keepAwake, orientationLock] = await Promise.all([
      getSetting(KEYS.mode),
      getSetting(KEYS.direction),
      getSetting(KEYS.brightness),
      getSetting(KEYS.keepAwake),
      getSetting(KEYS.orientationLock),
    ]);
    set({
      // 'double' page mode was removed — any previously persisted value falls back to 'single'.
      mode: mode === 'vertical' ? 'vertical' : 'single',
      direction: (direction as ReadingDirection) ?? 'rtl',
      brightnessOverlay: brightness ? Number(brightness) : 0,
      keepAwake: keepAwake ? keepAwake === 'true' : true,
      orientationLock: orientationLock === 'auto' || orientationLock === 'landscape' ? orientationLock : 'portrait',
      hydrated: true,
    });
  },
  setMode: (mode) => {
    set({ mode });
    void setSetting(KEYS.mode, mode);
  },
  setDirection: (direction) => {
    set({ direction });
    void setSetting(KEYS.direction, direction);
  },
  setBrightnessOverlay: (brightnessOverlay) => {
    set({ brightnessOverlay });
    void setSetting(KEYS.brightness, String(brightnessOverlay));
  },
  setKeepAwake: (keepAwake) => {
    set({ keepAwake });
    void setSetting(KEYS.keepAwake, String(keepAwake));
  },
  setOrientationLock: (orientationLock) => {
    set({ orientationLock });
    void setSetting(KEYS.orientationLock, orientationLock);
  },
}));
