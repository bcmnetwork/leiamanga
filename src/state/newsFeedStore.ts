import { create } from 'zustand';

import { getSetting, setSetting } from '@/src/db/repository';
import { fetchFeedItems } from '@/src/services/news/rssService';

interface NewsFeedState {
  feeds: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addFeed: (url: string) => void;
  removeFeed: (url: string) => void;
  /** Newest article timestamp the user has already seen (persisted). */
  lastSeenPubDate: string | null;
  /** True when a fetched feed has an article newer than `lastSeenPubDate` — drives the tab badge. */
  hasUnread: boolean;
  /** Fetches all feeds in the background (independent of the News screen being open) just to check for new items. */
  checkForUnread: () => Promise<void>;
  /** Called once the News screen has shown the current items, so the badge clears. */
  markAllSeen: (newestPubDate: string | null) => void;
}

const FEEDS_KEY = 'news.feeds';
const LAST_SEEN_KEY = 'news.lastSeenPubDate';

export const useNewsFeedStore = create<NewsFeedState>((set, get) => ({
  feeds: [],
  hydrated: false,
  lastSeenPubDate: null,
  hasUnread: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const raw = await getSetting(FEEDS_KEY);
    let feeds: string[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) feeds = parsed.filter((v): v is string => typeof v === 'string');
      } catch {
        // Malformed persisted value — fall back to no feeds instead of crashing.
      }
    }
    const lastSeenPubDate = await getSetting(LAST_SEEN_KEY);
    set({ feeds, lastSeenPubDate, hydrated: true });
  },

  addFeed: (url) => {
    const trimmed = url.trim();
    if (!trimmed || get().feeds.includes(trimmed)) return;
    const next = [...get().feeds, trimmed];
    set({ feeds: next });
    void setSetting(FEEDS_KEY, JSON.stringify(next));
  },

  removeFeed: (url) => {
    const next = get().feeds.filter((f) => f !== url);
    set({ feeds: next });
    void setSetting(FEEDS_KEY, JSON.stringify(next));
  },

  checkForUnread: async () => {
    const { feeds, lastSeenPubDate } = get();
    if (feeds.length === 0) return;
    const results = await Promise.allSettled(feeds.map((url) => fetchFeedItems(url)));
    let newest = 0;
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        const time = item.pubDate ? new Date(item.pubDate).getTime() : NaN;
        if (!Number.isNaN(time) && time > newest) newest = time;
      }
    }
    if (newest === 0) return;
    const lastSeenTime = lastSeenPubDate ? new Date(lastSeenPubDate).getTime() : 0;
    set({ hasUnread: newest > lastSeenTime });
  },

  markAllSeen: (newestPubDate) => {
    if (!newestPubDate) {
      set({ hasUnread: false });
      return;
    }
    set({ lastSeenPubDate: newestPubDate, hasUnread: false });
    void setSetting(LAST_SEEN_KEY, newestPubDate);
  },
}));

