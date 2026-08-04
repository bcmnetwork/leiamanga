import { useEffect, useState } from 'react';

import {
    getChapterPages,
    type ProviderChapterPage,
} from '@/src/services/contentProvider/ContentCatalogService';
import type { ContentProviderSession } from '@/src/services/contentProvider/ContentProviderService';

export interface ProviderChapterPagesResult {
  loading: boolean;
  error: string | null;
  pages: ProviderChapterPage[];
}

/** Fetches page image URLs for a remote (connected-provider) chapter. */
export function useProviderChapterPages(
  session: ContentProviderSession | null,
  slug: string | undefined,
  chapterId: string | undefined,
): ProviderChapterPagesResult {
  const [state, setState] = useState<ProviderChapterPagesResult>({
    loading: true,
    error: null,
    pages: [],
  });

  useEffect(() => {
    let cancelled = false;
    if (!session || !slug || !chapterId) {
      setState({ loading: false, error: 'Capítulo inválido.', pages: [] });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const result = await getChapterPages(session, slug, chapterId);
        if (cancelled) return;
        setState({ loading: false, error: null, pages: result.pages });
      } catch (error) {
        if (cancelled) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Falha ao carregar páginas do capítulo.',
          pages: [],
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, slug, chapterId]);

  return state;
}
