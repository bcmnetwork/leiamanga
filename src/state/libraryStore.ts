import { create } from 'zustand';

import { listSeries, ListSeriesOptions } from '@/src/db/repository';
import type { SeriesWithProgress } from '@/src/db/types';

export type LibrarySortBy = 'title' | 'recent' | 'lastRead';

interface LibraryState {
  series: SeriesWithProgress[];
  loading: boolean;
  query: string;
  favoritesOnly: boolean;
  sortBy: LibrarySortBy;
  setQuery: (query: string) => void;
  setFavoritesOnly: (value: boolean) => void;
  setSortBy: (sortBy: LibrarySortBy) => void;
  refresh: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  series: [],
  loading: false,
  query: '',
  favoritesOnly: false,
  sortBy: 'title',
  setQuery: (query) => {
    set({ query });
    void get().refresh();
  },
  setFavoritesOnly: (favoritesOnly) => {
    set({ favoritesOnly });
    void get().refresh();
  },
  setSortBy: (sortBy) => {
    set({ sortBy });
    void get().refresh();
  },
  refresh: async () => {
    set({ loading: true });
    const { query, favoritesOnly, sortBy } = get();
    const options: ListSeriesOptions = { query: query || undefined, favoritesOnly, sortBy };
    const series = await listSeries(options);
    set({ series, loading: false });
  },
}));
