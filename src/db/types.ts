export interface SeriesRow {
  id: string;
  title: string;
  folder_path: string | null;
  cover_path: string | null;
  description: string | null;
  genre: string | null;
  favorite: number;
  created_at: number;
}

export interface ChapterRow {
  id: string;
  series_id: string;
  title: string;
  source_uri: string;
  pages_dir: string;
  page_count: number;
  sort_order: number;
  added_at: number;
}

export interface ChapterWithProgress extends ChapterRow {
  last_page: number;
}

export interface SeriesWithProgress extends SeriesRow {
  chapterCount: number;
  lastReadAt: number | null;
}
