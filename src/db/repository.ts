import { generateId } from '../utils/id';
import { getDb } from './client';
import type { ChapterRow, ChapterWithProgress, SeriesRow, SeriesWithProgress } from './types';

export async function createSeriesIfNeeded(title: string, folderPath?: string): Promise<string> {
  const db = await getDb();
  const existing = await db.getFirstAsync<SeriesRow>(
    'SELECT * FROM series WHERE title = ? LIMIT 1',
    title
  );
  if (existing) {
    return existing.id;
  }

  const id = generateId();
  await db.runAsync(
    'INSERT INTO series (id, title, folder_path, cover_path, favorite, created_at) VALUES (?, ?, ?, NULL, 0, ?)',
    id,
    title,
    folderPath ?? null,
    Date.now()
  );
  return id;
}

export interface CreateChapterInput {
  id: string;
  seriesId: string;
  title: string;
  sourceUri: string;
  pagesDir: string;
  pageFiles: string[];
  coverFile: string | null;
}

export async function createChapter(input: CreateChapterInput): Promise<void> {
  const db = await getDb();
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM chapters WHERE series_id = ?',
    input.seriesId
  );
  const sortOrder = countRow?.count ?? 0;

  await db.runAsync(
    `INSERT INTO chapters (id, series_id, title, source_uri, pages_dir, page_count, sort_order, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.id,
    input.seriesId,
    input.title,
    input.sourceUri,
    input.pagesDir,
    input.pageFiles.length,
    sortOrder,
    Date.now()
  );

  await db.runAsync(
    'INSERT INTO reading_progress (chapter_id, last_page, updated_at) VALUES (?, 0, ?)',
    input.id,
    Date.now()
  );

  if (input.coverFile) {
    const series = await db.getFirstAsync<SeriesRow>('SELECT * FROM series WHERE id = ?', input.seriesId);
    if (series && !series.cover_path) {
      const coverPath = `${input.pagesDir}/${input.coverFile}`;
      await db.runAsync('UPDATE series SET cover_path = ? WHERE id = ?', coverPath, input.seriesId);
    }
  }
}

export interface ListSeriesOptions {
  query?: string;
  favoritesOnly?: boolean;
  sortBy?: 'title' | 'recent' | 'lastRead';
}

export async function listSeries(options: ListSeriesOptions = {}): Promise<SeriesWithProgress[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (options.query) {
    conditions.push('s.title LIKE ?');
    params.push(`%${options.query}%`);
  }
  if (options.favoritesOnly) {
    conditions.push('s.favorite = 1');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy =
    options.sortBy === 'lastRead'
      ? 'lastReadAt DESC'
      : options.sortBy === 'recent'
        ? 's.created_at DESC'
        : 's.title COLLATE NOCASE ASC';

  return db.getAllAsync<SeriesWithProgress>(
    `
    SELECT s.*,
      (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) as chapterCount,
      (SELECT MAX(rp.updated_at) FROM reading_progress rp
        JOIN chapters c2 ON c2.id = rp.chapter_id
        WHERE c2.series_id = s.id AND rp.last_page > 0) as lastReadAt
    FROM series s
    ${where}
    ORDER BY ${orderBy}
    `,
    ...params
  );
}

export async function getSeriesById(id: string): Promise<SeriesRow | null> {
  const db = await getDb();
  return db.getFirstAsync<SeriesRow>('SELECT * FROM series WHERE id = ?', id);
}

/** Sets the series cover only if it doesn't already have one — used to attach the
 * work's real cover image the first time a provider chapter is downloaded, without
 * overwriting a cover a user (or a prior download) already set. */
export async function setSeriesCoverIfMissing(seriesId: string, coverPath: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE series SET cover_path = ? WHERE id = ? AND (cover_path IS NULL OR cover_path = \'\')',
    coverPath,
    seriesId
  );
}

export async function toggleFavorite(seriesId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE series SET favorite = 1 - favorite WHERE id = ?', seriesId);
}

export async function listChaptersForSeries(seriesId: string): Promise<ChapterWithProgress[]> {
  const db = await getDb();
  return db.getAllAsync<ChapterWithProgress>(
    `
    SELECT c.*, COALESCE(rp.last_page, 0) as last_page
    FROM chapters c
    LEFT JOIN reading_progress rp ON rp.chapter_id = c.id
    WHERE c.series_id = ?
    ORDER BY c.sort_order ASC
    `,
    seriesId
  );
}

export async function getChapterById(chapterId: string): Promise<ChapterRow | null> {
  const db = await getDb();
  return db.getFirstAsync<ChapterRow>('SELECT * FROM chapters WHERE id = ?', chapterId);
}

/** Returns the chapter that comes right after (or before) the given one within its series. */
export async function getAdjacentChapter(
  seriesId: string,
  sortOrder: number,
  direction: 'next' | 'prev'
): Promise<ChapterRow | null> {
  const db = await getDb();
  if (direction === 'next') {
    return db.getFirstAsync<ChapterRow>(
      'SELECT * FROM chapters WHERE series_id = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1',
      seriesId,
      sortOrder
    );
  }
  return db.getFirstAsync<ChapterRow>(
    'SELECT * FROM chapters WHERE series_id = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1',
    seriesId,
    sortOrder
  );
}

export async function deleteChapter(chapterId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reading_progress WHERE chapter_id = ?', chapterId);
  await db.runAsync('DELETE FROM chapters WHERE id = ?', chapterId);
}

export async function deleteSeriesWithChapters(seriesId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM reading_progress WHERE chapter_id IN (SELECT id FROM chapters WHERE series_id = ?)',
    seriesId
  );
  await db.runAsync('DELETE FROM chapters WHERE series_id = ?', seriesId);
  await db.runAsync('DELETE FROM series WHERE id = ?', seriesId);
}

export async function deleteAllLibraryData(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reading_progress');
  await db.runAsync('DELETE FROM chapters');
  await db.runAsync('DELETE FROM series');
}

export async function getChapterBySourceUri(sourceUri: string): Promise<ChapterRow | null> {
  const db = await getDb();
  return db.getFirstAsync<ChapterRow>('SELECT * FROM chapters WHERE source_uri = ?', sourceUri);
}

export async function listSourceUrisWithPrefix(prefix: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ source_uri: string }>(
    'SELECT source_uri FROM chapters WHERE source_uri LIKE ?',
    `${prefix}%`
  );
  return rows.map((row) => row.source_uri);
}

export async function saveProgress(chapterId: string, lastPage: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reading_progress (chapter_id, last_page, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(chapter_id) DO UPDATE SET last_page = excluded.last_page, updated_at = excluded.updated_at`,
    chapterId,
    lastPage,
    Date.now()
  );
}

export async function getProgress(chapterId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ last_page: number }>(
    'SELECT last_page FROM reading_progress WHERE chapter_id = ?',
    chapterId
  );
  return row?.last_page ?? 0;
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}
