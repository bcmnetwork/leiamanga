/**
 * Downloads a connected-provider chapter's pages to local storage and registers
 * it in the same local SQLite library used by CBZ imports, so it shows up in the
 * "Biblioteca" tab and can be read fully offline (with progress tracking) like
 * any other imported chapter.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { createChapter, createSeriesIfNeeded, getChapterBySourceUri, getSeriesById, setSeriesCoverIfMissing } from '@/src/db/repository';
import { generateId } from '@/src/utils/id';
import { getChapterPages, type ProviderChapterSummary, type ProviderWorkDetail } from './ContentCatalogService';
import type { ContentProviderSession } from './ContentProviderService';

const DEFAULT_EXTENSION = 'jpg';

function buildSourceUri(session: ContentProviderSession, workSlug: string, chapterId: string): string {
  return `provider:${session.domain}:${workSlug}:${chapterId}`;
}

/** Prefix shared by all downloaded chapters of a given work, used to detect which ones are already saved offline. */
export function buildProviderSourcePrefix(session: ContentProviderSession, workSlug: string): string {
  return `provider:${session.domain}:${workSlug}:`;
}

export function chapterIdFromSourceUri(sourceUri: string, prefix: string): string {
  return sourceUri.slice(prefix.length);
}

function guessExtension(imageUrl: string): string {
  const path = imageUrl.split('?')[0] ?? '';
  const match = /\.([a-z0-9]{2,4})$/i.exec(path);
  return match ? match[1].toLowerCase() : DEFAULT_EXTENSION;
}

export async function isChapterDownloaded(
  session: ContentProviderSession,
  workSlug: string,
  chapterId: string,
): Promise<boolean> {
  const existing = await getChapterBySourceUri(buildSourceUri(session, workSlug, chapterId));
  return existing !== null;
}

export async function downloadChapterForOffline(
  session: ContentProviderSession,
  work: ProviderWorkDetail,
  chapter: ProviderChapterSummary,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const sourceUri = buildSourceUri(session, work.slug, chapter.id);
  const alreadyDownloaded = await getChapterBySourceUri(sourceUri);
  if (alreadyDownloaded) return;

  const { pages } = await getChapterPages(session, work.slug, chapter.id);
  if (pages.length === 0) {
    throw new Error('Este capítulo não tem páginas para baixar.');
  }

  const chapterId = generateId();
  const destDir = new Directory(Paths.document, 'chapters', chapterId);
  destDir.create({ intermediates: true, idempotent: true });

  const seriesId = await createSeriesIfNeeded(work.title);

  // Download the work's real cover once per series (not a page image) — best-effort,
  // a failed cover download must not block the chapter download itself.
  try {
    const series = await getSeriesById(seriesId);
    if (series && !series.cover_path && work.coverUrl) {
      const coverDir = new Directory(Paths.document, 'series', seriesId);
      coverDir.create({ intermediates: true, idempotent: true });
      const coverFile = new File(coverDir, `cover.${guessExtension(work.coverUrl)}`);
      await File.downloadFileAsync(work.coverUrl, coverFile, { idempotent: true });
      await setSeriesCoverIfMissing(seriesId, coverFile.uri);
    }
  } catch {
    // Non-critical — the series will simply have no cover image yet.
  }

  const pageFiles: string[] = [];
  try {
    const sortedPages = pages.slice().sort((a, b) => a.index - b.index);
    onProgress?.(0, sortedPages.length);
    for (const page of sortedPages) {
      const ext = guessExtension(page.imageUrl);
      const pageFileName = `page-${String(page.index + 1).padStart(4, '0')}.${ext}`;
      const target = new File(destDir, pageFileName);
      await File.downloadFileAsync(page.imageUrl, target, { idempotent: true });
      pageFiles.push(pageFileName);
      onProgress?.(pageFiles.length, sortedPages.length);
    }
  } catch {
    destDir.delete();
    throw new Error('Falha ao baixar as páginas do capítulo. Verifique sua conexão e tente novamente.');
  }

  await createChapter({
    id: chapterId,
    seriesId,
    title: `Capítulo ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ''}`,
    sourceUri,
    pagesDir: destDir.uri,
    pageFiles,
    coverFile: null,
  });
}
