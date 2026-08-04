/**
 * Sequential offline-download queue for provider chapters. Chapters are always
 * processed one at a time (the underlying download is heavy — many page
 * requests — so parallelizing them isn't worth the complexity), but the user
 * can enqueue as many chapters as they want without waiting for each one to
 * finish before tapping the next.
 */
import * as Network from 'expo-network';
import { create } from 'zustand';

import type { ProviderChapterSummary, ProviderWorkDetail } from '@/src/services/contentProvider/ContentCatalogService';
import type { ContentProviderSession } from '@/src/services/contentProvider/ContentProviderService';
import { downloadChapterForOffline } from '@/src/services/contentProvider/downloadChapter';
import { useDownloadSettingsStore } from '@/src/state/downloadSettingsStore';

export type DownloadStatus = 'queued' | 'downloading' | 'done' | 'error';

export function downloadKey(workSlug: string, chapterId: string): string {
  return `${workSlug}:${chapterId}`;
}

export interface DownloadProgress {
  done: number;
  total: number;
}

export interface DownloadMeta {
  workTitle: string;
  workSlug: string;
  chapterNumber: number;
  chapterTitle: string | null;
}

interface QueueItem {
  key: string;
  session: ContentProviderSession;
  work: ProviderWorkDetail;
  chapter: ProviderChapterSummary;
}

/** Active listener that resumes the queue as soon as Wi-Fi comes back, registered lazily. */
let wifiWatcher: { remove: () => void } | null = null;

function watchForWifi(resume: () => void) {
  if (wifiWatcher) return;
  wifiWatcher = Network.addNetworkStateListener((state) => {
    if (state.type === Network.NetworkStateType.WIFI) {
      wifiWatcher?.remove();
      wifiWatcher = null;
      resume();
    }
  });
}

interface DownloadQueueState {
  statuses: Record<string, DownloadStatus>;
  errors: Record<string, string>;
  progress: Record<string, DownloadProgress>;
  meta: Record<string, DownloadMeta>;
  /** Retained even after an item leaves `queue`, so a failed download can be retried without re-navigating to the work. */
  items: Record<string, QueueItem>;
  queue: QueueItem[];
  processing: boolean;
  /** True when the next item is ready but held back because Wi-Fi-only downloads are enabled and there's no Wi-Fi. */
  waitingForWifi: boolean;
  enqueue: (session: ContentProviderSession, work: ProviderWorkDetail, chapter: ProviderChapterSummary) => void;
  retry: (key: string) => void;
  removeItem: (key: string) => void;
  /** @deprecated use removeItem — kept for existing call sites that clear a stale error before re-enqueuing. */
  clearError: (key: string) => void;
  clearFinished: () => void;
  /** Re-checks Wi-Fi-only gating and resumes processing — call after toggling the setting off. */
  resumeQueue: () => void;
  _processNext: () => void;
  _startItem: (item: QueueItem) => void;
}

export const useDownloadQueueStore = create<DownloadQueueState>((set, get) => ({
  statuses: {},
  errors: {},
  progress: {},
  meta: {},
  items: {},
  queue: [],
  processing: false,
  waitingForWifi: false,

  enqueue: (session, work, chapter) => {
    const key = downloadKey(work.slug, chapter.id);
    const status = get().statuses[key];
    if (status === 'queued' || status === 'downloading' || status === 'done') return;
    const item: QueueItem = { key, session, work, chapter };
    set((state) => ({
      statuses: { ...state.statuses, [key]: 'queued' },
      errors: Object.fromEntries(Object.entries(state.errors).filter(([k]) => k !== key)),
      progress: { ...state.progress, [key]: { done: 0, total: 0 } },
      meta: {
        ...state.meta,
        [key]: {
          workTitle: work.title,
          workSlug: work.slug,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title ?? null,
        },
      },
      items: { ...state.items, [key]: item },
      queue: [...state.queue, item],
    }));
    get()._processNext();
  },

  retry: (key) => {
    const item = get().items[key];
    if (!item || get().statuses[key] !== 'error') return;
    set((state) => ({
      statuses: { ...state.statuses, [key]: 'queued' },
      errors: Object.fromEntries(Object.entries(state.errors).filter(([k]) => k !== key)),
      progress: { ...state.progress, [key]: { done: 0, total: 0 } },
      queue: [...state.queue, item],
    }));
    get()._processNext();
  },

  removeItem: (key) => {
    set((state) => {
      const errors = { ...state.errors };
      delete errors[key];
      const statuses = { ...state.statuses };
      delete statuses[key];
      const progress = { ...state.progress };
      delete progress[key];
      const meta = { ...state.meta };
      delete meta[key];
      const items = { ...state.items };
      delete items[key];
      return { errors, statuses, progress, meta, items, queue: state.queue.filter((q) => q.key !== key) };
    });
  },

  clearError: (key) => get().removeItem(key),

  resumeQueue: () => get()._processNext(),

  clearFinished: () => {
    set((state) => {
      const doneKeys = new Set(
        Object.entries(state.statuses)
          .filter(([, status]) => status === 'done')
          .map(([key]) => key),
      );
      const statuses = Object.fromEntries(Object.entries(state.statuses).filter(([k]) => !doneKeys.has(k)));
      const progress = Object.fromEntries(Object.entries(state.progress).filter(([k]) => !doneKeys.has(k)));
      const meta = Object.fromEntries(Object.entries(state.meta).filter(([k]) => !doneKeys.has(k)));
      const items = Object.fromEntries(Object.entries(state.items).filter(([k]) => !doneKeys.has(k)));
      return { statuses, progress, meta, items };
    });
  },

  _processNext: () => {
    if (get().processing) return;
    const item = get().queue[0];
    if (!item) return;

    if (useDownloadSettingsStore.getState().wifiOnly) {
      void Network.getNetworkStateAsync().then((netState) => {
        if (netState.type === Network.NetworkStateType.WIFI) {
          set({ waitingForWifi: false });
          get()._startItem(item);
        } else {
          set({ waitingForWifi: true });
          watchForWifi(() => get()._processNext());
        }
      });
      return;
    }

    set({ waitingForWifi: false });
    get()._startItem(item);
  },

  _startItem: (item: QueueItem) => {
    set((state) => ({ processing: true, statuses: { ...state.statuses, [item.key]: 'downloading' } }));

    void downloadChapterForOffline(item.session, item.work, item.chapter, (done, total) => {
      set((state) => ({ progress: { ...state.progress, [item.key]: { done, total } } }));
    })
      .then(() => {
        set((state) => ({ statuses: { ...state.statuses, [item.key]: 'done' } }));
      })
      .catch((err: unknown) => {
        set((state) => ({
          statuses: { ...state.statuses, [item.key]: 'error' },
          errors: { ...state.errors, [item.key]: err instanceof Error ? err.message : 'Falha ao baixar o capítulo.' },
        }));
      })
      .finally(() => {
        set((state) => ({ queue: state.queue.filter((q) => q.key !== item.key), processing: false }));
        get()._processNext();
      });
  },
}));
