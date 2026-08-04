/**
 * Combines local-library file cleanup with the DB rows that track a chapter/series,
 * for content downloaded via CBZ import or a connected provider.
 *
 * "Removing" a chapter/series only deletes its files on disk and flags the chapter as
 * not-downloaded — the series/chapter rows and reading progress are kept so the user's
 * reading history survives, and a provider-linked chapter can be re-downloaded later.
 */
import { Directory, Paths } from 'expo-file-system';

import {
    deleteAllLibraryData,
    deleteSeriesWithChapters,
    getChapterById,
    listChaptersForSeries,
    setChapterDownloaded,
} from './repository';

function deleteDirSafe(uri: string): void {
  try {
    new Directory(uri).delete();
  } catch {
    // Already missing or inaccessible — nothing to clean up.
  }
}

export async function deleteDownloadedChapter(chapterId: string): Promise<void> {
  const chapter = await getChapterById(chapterId);
  if (!chapter) return;
  deleteDirSafe(chapter.pages_dir);
  await setChapterDownloaded(chapterId, false);
}

export async function deleteDownloadedSeries(seriesId: string): Promise<void> {
  const chapters = await listChaptersForSeries(seriesId);
  // No chapters ever attached to this series (e.g. "Criar obra" abandoned before adding
  // anything) — there's no reading history worth preserving, so remove the row for real,
  // otherwise it would be stuck in the library forever with nothing to soft-delete.
  if (chapters.length === 0) {
    await deleteSeriesWithChapters(seriesId);
    return;
  }
  for (const chapter of chapters) {
    deleteDirSafe(chapter.pages_dir);
    await setChapterDownloaded(chapter.id, false);
  }
}


export async function deleteAllDownloads(): Promise<void> {
  await deleteAllLibraryData();
  deleteDirSafe(new Directory(Paths.document, 'chapters').uri);
  deleteDirSafe(new Directory(Paths.document, 'series').uri);
}

