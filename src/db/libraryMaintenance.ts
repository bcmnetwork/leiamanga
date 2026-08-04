/**
 * Combines local-library DB deletion with removal of the corresponding files on
 * disk, for chapters/series downloaded via CBZ import or a connected provider.
 */
import { Directory, Paths } from 'expo-file-system';

import {
    deleteAllLibraryData,
    deleteChapter,
    deleteSeriesWithChapters,
    getChapterById,
    listChaptersForSeries,
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
  await deleteChapter(chapterId);
  if (chapter) deleteDirSafe(chapter.pages_dir);
}

export async function deleteDownloadedSeries(seriesId: string): Promise<void> {
  const chapters = await listChaptersForSeries(seriesId);
  await deleteSeriesWithChapters(seriesId);
  for (const chapter of chapters) deleteDirSafe(chapter.pages_dir);
}

export async function deleteAllDownloads(): Promise<void> {
  await deleteAllLibraryData();
  deleteDirSafe(new Directory(Paths.document, 'chapters').uri);
  deleteDirSafe(new Directory(Paths.document, 'series').uri);
}
