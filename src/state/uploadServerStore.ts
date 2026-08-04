/**
 * Manages the on-device local upload server's lifecycle (start/stop) and the
 * log of received files. See `src/services/uploadServer/uploadServerService.ts`
 * for why this requires a custom dev client build (not available in Expo Go).
 */
import * as Network from 'expo-network';
import { create } from 'zustand';

import {
    generateUploadPassword,
    startUploadServer,
    UPLOAD_SERVER_PORT,
    type UploadResult,
    type UploadServerHandle,
} from '@/src/services/uploadServer/uploadServerService';

interface UploadServerState {
  running: boolean;
  starting: boolean;
  ip: string | null;
  port: number;
  /** 6-digit PIN required to use the server — freshly generated each start, never persisted. */
  password: string | null;
  log: UploadResult[];
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

let handle: UploadServerHandle | null = null;

export const useUploadServerStore = create<UploadServerState>((set, get) => ({
  running: false,
  starting: false,
  ip: null,
  port: UPLOAD_SERVER_PORT,
  password: null,
  log: [],
  error: null,

  start: async () => {
    if (get().running || get().starting) return;
    set({ starting: true, error: null });
    try {
      const ip = await Network.getIpAddressAsync();
      const password = generateUploadPassword();
      handle = startUploadServer((result) => {
        set((state) => ({ log: [result, ...state.log].slice(0, 30) }));
      }, password);
      set({ running: true, starting: false, ip, password, log: [] });
    } catch (err) {
      set({
        starting: false,
        error: err instanceof Error ? err.message : 'Não foi possível iniciar o servidor.',
      });
    }
  },

  stop: () => {
    handle?.stop();
    handle = null;
    set({ running: false, ip: null, password: null });
  },
}));

