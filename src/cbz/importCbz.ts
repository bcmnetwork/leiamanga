import * as DocumentPicker from 'expo-document-picker';
import { Directory, Paths } from 'expo-file-system';

import { createChapter, createSeriesIfNeeded } from '../db/repository';
import { generateId } from '../utils/id';
import { extractCbzToDirectory } from './extractCbz';

function guessSeriesTitle(fileName: string): string {
  return fileName.replace(/\.cbz$/i, '').replace(/_/g, ' ').trim();
}

export interface ImportSummary {
  imported: number;
  failed: number;
}

/** Extracts and registers a single CBZ file already sitting at `uri` (e.g. from the document picker or a received upload).
 * When `seriesId` is provided, the chapter is attached to that existing series instead of guessing/creating one from the file name. */
export async function importCbzFromUri(uri: string, fileName: string, seriesId?: string): Promise<void> {
  const chapterId = generateId();
  const chapterTitle = guessSeriesTitle(fileName);
  const resolvedSeriesId = seriesId ?? (await createSeriesIfNeeded(chapterTitle));
  const destDir = new Directory(Paths.document, 'chapters', chapterId);
  const extracted = await extractCbzToDirectory(uri, destDir);

  await createChapter({
    id: chapterId,
    seriesId: resolvedSeriesId,
    title: chapterTitle,
    sourceUri: uri,
    pagesDir: extracted.pagesDir,
    pageFiles: extracted.pageFiles,
    coverFile: extracted.coverFile,
  });
}

export async function pickAndImportCbzFiles(seriesId?: string): Promise<ImportSummary> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    type: ['application/vnd.comicbook+zip', 'application/zip', 'application/x-cbz', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return { imported: 0, failed: 0 };
  }

  let imported = 0;
  let failed = 0;

  for (const asset of result.assets) {
    try {
      await importCbzFromUri(asset.uri, asset.name, seriesId);
      imported += 1;
    } catch (error) {
      console.warn('Falha ao importar CBZ', asset.name, error);
      failed += 1;
    }
  }

  return { imported, failed };
}
