import { create } from 'zustand';

import {
    contentProviderService,
    type ContentProviderSession,
} from '@/src/services/contentProvider/ContentProviderService';

interface ContentProviderState {
  session: ContentProviderSession | null;
  hydrated: boolean;
  connecting: boolean;
  disconnecting: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  connect: (domain: string, email: string, password: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

export const useContentProviderStore = create<ContentProviderState>((set) => ({
  session: null,
  hydrated: false,
  connecting: false,
  disconnecting: false,
  error: null,
  hydrate: async () => {
    const session = await contentProviderService.getSession();
    set({ session, hydrated: true });
  },
  connect: async (domain, email, password) => {
    set({ connecting: true, error: null });
    try {
      const session = await contentProviderService.connect(domain, email, password);
      set({ session, connecting: false });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível conectar.';
      set({ connecting: false, error: message });
      return false;
    }
  },
  disconnect: async () => {
    set({ disconnecting: true });
    await contentProviderService.disconnect();
    set({ session: null, disconnecting: false });
  },
  clearError: () => set({ error: null }),
}));
