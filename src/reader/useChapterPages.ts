import { Directory } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { naturalCompare } from '@/src/cbz/naturalSort';
import { getChapterById } from '@/src/db/repository';
import type { ChapterRow } from '@/src/db/types';

export interface ChapterPagesResult {
  loading: boolean;
  error: string | null;
  chapter: ChapterRow | null;
  pageUris: string[];
}

export function useChapterPages(chapterId: string | undefined): ChapterPagesResult {
  const [state, setState] = useState<ChapterPagesResult>({
    loading: true,
    error: null,
    chapter: null,
    pageUris: [],
  });

  useEffect(() => {
    let cancelled = false;
    if (!chapterId) {
      setState({ loading: false, error: 'Capítulo inválido.', chapter: null, pageUris: [] });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const chapter = await getChapterById(chapterId);
        if (!chapter) {
          throw new Error('Capítulo não encontrado.');
        }
        const dir = new Directory(chapter.pages_dir);
        const files = dir
          .list()
          .filter((entry) => entry.uri.match(/\.(jpe?g|png|webp|gif|bmp)$/i))
          .map((entry) => entry.uri)
          .sort(naturalCompare);

        if (cancelled) return;
        setState({ loading: false, error: null, chapter, pageUris: files });
      } catch {
        if (cancelled) return;
        setState({
          loading: false,
          error: 'Falha ao carregar páginas do capítulo.',
          chapter: null,
          pageUris: [],
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  return state;
}
