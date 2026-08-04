/**
 * Sequential offline-download queue for provider chapters. Chapters are always
 * processed one at a time (the underlying download is heavy — many page
 * requests — so parallelizing them isn't worth the complexity), but the user
 * can enqueue as many chapters as they want without waiting for each one to
 * finish before tapping the next.
 */
import { create } from 'zustand';

import type { ProviderChapterSummary, ProviderWorkDetail } from '@/src/services/contentProvider/ContentCatalogService';
import type { ContentProviderSession } from '@/src/services/contentProvider/ContentProviderService';
import { downloadChapterForOffline } from '@/src/services/contentProvider/downloadChapter';

export type DownloadStatus = 'queued' | 'downloading' | 'done' | 'error';

export function downloadKey(workSlug: string, chapterId: string): string {
  return `${workSlug}:${chapterId}`;
}

interface QueueItem {
  key: string;
  session: ContentProviderSession;
  work: ProviderWorkDetail;
  chapter: ProviderChapterSummary;
}

interface DownloadQueueState {
  statuses: Record<string, DownloadStatus>;
  errors: Record<string, string>;
  queue: QueueItem[];
  processing: boolean;
  enqueue: (session: ContentProviderSession, work: ProviderWorkDetail, chapter: ProviderChapterSummary) => void;
  clearError: (key: string) => void;
  _processNext: () => void;
}

export const useDownloadQueueStore = create<DownloadQueueState>((set, get) => ({
  statuses: {},
  errors: {},
  queue: [],
  processing: false,

  enqueue: (session, work, chapter) => {
    const key = downloadKey(work.slug, chapter.id);
    const status = get().statuses[key];
    if (status === 'queued' || status === 'downloading' || status === 'done') return;
    set((state) => ({
      statuses: { ...state.statuses, [key]: 'queued' },
      errors: Object.fromEntries(Object.entries(state.errors).filter(([k]) => k !== key)),
      queue: [...state.queue, { key, session, work, chapter }],
    }));
    get()._processNext();
  },

  clearError: (key) => {
    set((state) => {
      const errors = { ...state.errors };
      delete errors[key];
      const statuses = { ...state.statuses };
      delete statuses[key];
      return { errors, statuses };
    });
  },

  _processNext: () => {
    if (get().processing) return;
    const item = get().queue[0];
    if (!item) return;

    set((state) => ({ processing: true, statuses: { ...state.statuses, [item.key]: 'downloading' } }));

    void downloadChapterForOffline(item.session, item.work, item.chapter)
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
