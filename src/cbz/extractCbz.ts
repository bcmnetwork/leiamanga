import { Directory, File } from 'expo-file-system';
import { unzipSync } from 'fflate';

import { naturalCompare } from './naturalSort';

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|webp|gif|bmp)$/i;

export interface ExtractedChapter {
  pagesDir: string;
  pageFiles: string[];
  coverFile: string | null;
}

// CBZ is just a zip of images; fflate keeps this pure-JS so no native module / dev client is required.
export async function extractCbzToDirectory(
  cbzUri: string,
  destDir: Directory
): Promise<ExtractedChapter> {
  const sourceFile = new File(cbzUri);
  const bytes = await sourceFile.bytes();
  const entries = unzipSync(bytes);

  const imageNames = Object.keys(entries)
    .filter((name) => {
      const baseName = name.split('/').pop() ?? '';
      return !name.endsWith('/') && IMAGE_EXTENSION_RE.test(name) && !baseName.startsWith('.');
    })
    .sort(naturalCompare);

  if (imageNames.length === 0) {
    throw new Error('Nenhuma imagem encontrada dentro do arquivo CBZ.');
  }

  destDir.create({ intermediates: true, idempotent: true });

  const pageFiles: string[] = [];
  imageNames.forEach((entryName, index) => {
    const ext = entryName.slice(entryName.lastIndexOf('.'));
    const pageFileName = `page-${String(index + 1).padStart(4, '0')}${ext}`;
    const file = new File(destDir, pageFileName);
    file.write(entries[entryName]);
    pageFiles.push(pageFileName);
  });

  return {
    pagesDir: destDir.uri,
    pageFiles,
    coverFile: pageFiles[0] ?? null,
  };
}
