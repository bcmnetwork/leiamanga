/**
 * Catalog/reading client for a connected content provider (see
 * ContentProviderService.ts). Talks to the same App API (`/v1/www/*`) the
 * provider's own website frontend uses, authenticated with the Bearer token
 * obtained via `/v1/auth/connect`.
 */
import type { ContentProviderSession } from './ContentProviderService';
import { ProviderConnectionError } from './ContentProviderService';

const REQUEST_TIMEOUT_MS = 15000;

export interface ProviderWorkSummary {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  type: string;
  status: string;
  publicationStatus: string;
  chapterCount: number;
  isAdult: boolean;
  genres: string[];
}

export interface ProviderWorkDetail extends ProviderWorkSummary {
  description: string;
  tags: string[];
  rating: number;
  ratingCount: number;
  author?: string;
}

export interface ProviderCategory {
  slug: string;
  label: string;
}

export interface ProviderChapterSummary {
  id: string;
  number: number;
  title: string | null;
  publishedAt: string | null;
  isFree: boolean;
  isPremium: boolean;
  isLocked: boolean;
  isUpcoming?: boolean;
}

export interface ProviderChapterPage {
  index: number;
  imageUrl: string;
  isDouble?: boolean;
}

export interface ProviderCatalogPage {
  items: ProviderWorkSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type QueryParams = Record<string, string | number | string[] | undefined>;

async function authorizedFetch(
  session: ContentProviderSession,
  path: string,
  params?: QueryParams,
): Promise<Response> {
  const url = new URL(`${session.baseUrl}/www${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${session.token}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new ProviderConnectionError('Sua conexão com o site expirou. Conecte novamente.', 'session_expired');
      }
      if (response.status >= 500) {
        throw new ProviderConnectionError('O servidor deste site está com um problema técnico. Tente novamente mais tarde.', 'server_error');
      }
      let message = 'Não foi possível carregar os dados do site.';
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        if (body?.error?.message) message = body.error.message;
      } catch {
        // ignore — use default message
      }
      throw new ProviderConnectionError(message, 'request_failed');
    }
    return response;
  } catch (err) {
    if (err instanceof ProviderConnectionError) throw err;
    throw new ProviderConnectionError('Não foi possível conectar ao site. Verifique sua conexão.', 'connection_error');
  } finally {
    clearTimeout(timeout);
  }
}

async function authorizedGet<T>(
  session: ContentProviderSession,
  path: string,
  params?: QueryParams,
): Promise<T> {
  const response = await authorizedFetch(session, path, params);
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

async function authorizedGetWithMeta<T>(
  session: ContentProviderSession,
  path: string,
  params?: QueryParams,
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const response = await authorizedFetch(session, path, params);
  return (await response.json()) as { data: T; meta: Record<string, unknown> };
}

async function authorizedMutate(
  session: ContentProviderSession,
  method: 'POST' | 'DELETE' | 'PATCH',
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${session.baseUrl}/www${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ProviderConnectionError('Não foi possível conectar ao site. Verifique sua conexão.', 'connection_error');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ProviderConnectionError('O servidor deste site está com um problema técnico. Tente novamente mais tarde.', 'server_error');
    }
    throw new ProviderConnectionError('Não foi possível concluir a ação.', 'request_failed');
  }
}

export async function searchWorks(session: ContentProviderSession, query: string): Promise<ProviderWorkSummary[]> {
  return authorizedGet<ProviderWorkSummary[]>(session, '/search', { q: query, limit: 24 });
}

/** Browses the provider's full catalog (dedicated "discover" area), paginated. */
export async function getCatalog(
  session: ContentProviderSession,
  options: { q?: string; page?: number; limit?: number; genre?: string; type?: string } = {},
): Promise<ProviderCatalogPage> {
  const { data, meta } = await authorizedGetWithMeta<ProviderWorkSummary[]>(session, '/catalog', {
    q: options.q,
    page: options.page ?? 1,
    limit: options.limit ?? 24,
    genre: options.genre,
    type: options.type,
  });
  return {
    items: data,
    page: Number(meta.page ?? options.page ?? 1),
    limit: Number(meta.limit ?? options.limit ?? 24),
    total: Number(meta.total ?? 0),
    totalPages: Number(meta.totalPages ?? 0),
  };
}

/** Genre slugs (accent/case-stripped, e.g. "acao") with at least one active work. */
export async function getGenres(session: ContentProviderSession): Promise<string[]> {
  return authorizedGet<string[]>(session, '/catalog/genres');
}

/** Content categories (e.g. mangá, manhwa, manhua) active on the site's public catalog. */
export async function getCategories(session: ContentProviderSession): Promise<ProviderCategory[]> {
  const raw = await authorizedGet<{ slug?: string; label?: string }[]>(session, '/categories');
  return raw
    .filter((c): c is { slug: string; label: string } => Boolean(c.slug && c.label))
    .map((c) => ({ slug: c.slug, label: c.label }));
}

export async function getWork(session: ContentProviderSession, slug: string): Promise<ProviderWorkDetail> {
  return authorizedGet<ProviderWorkDetail>(session, `/works/${encodeURIComponent(slug)}`);
}

/** Fetches the FULL chapter list for a work, looping through server pages
 * (the API caps `limit` at 500 per page) so long-running works with 500+
 * chapters aren't silently truncated. */
export async function getChapters(session: ContentProviderSession, slug: string): Promise<ProviderChapterSummary[]> {
  const all: ProviderChapterSummary[] = [];
  let page = 1;
  const limit = 500;
  for (;;) {
    const { data, meta } = await authorizedGetWithMeta<ProviderChapterSummary[]>(
      session,
      `/works/${encodeURIComponent(slug)}/chapters`,
      { page, limit },
    );
    all.push(...data);
    const totalPages = Number(meta.totalPages ?? 1);
    if (page >= totalPages || data.length === 0) break;
    page += 1;
  }
  return all;
}

export async function getChapterPages(
  session: ContentProviderSession,
  slug: string,
  chapterId: string,
): Promise<{ chapterId: string; pages: ProviderChapterPage[] }> {
  return authorizedGet(session, `/works/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterId)}/pages`);
}

export async function getLibrary(session: ContentProviderSession): Promise<{ workSlug: string; workTitle: string; kind: string }[]> {
  return authorizedGet(session, '/library');
}

/** Per-chapter reading history for a work — `chapterId` here is the chapter NUMBER
 * as a string (e.g. "12", "12.5"), not the chapter's UUID, per the API contract. */
export async function getWorkChapterHistory(
  session: ContentProviderSession,
  workSlug: string
): Promise<{ chapterNumber: string; progressPercent: number }[]> {
  const rows = await authorizedGet<{ chapterId: string; progressPercent: number }[]>(
    session,
    `/history/${encodeURIComponent(workSlug)}`
  );
  return rows.map((r) => ({ chapterNumber: r.chapterId, progressPercent: r.progressPercent }));
}

export async function addToLibrary(session: ContentProviderSession, workSlug: string, workTitle: string): Promise<void> {
  await authorizedMutate(session, 'POST', '/library', { workSlug, workTitle, kind: 'following' });
}

export async function removeFromLibrary(session: ContentProviderSession, workSlug: string): Promise<void> {
  await authorizedMutate(session, 'DELETE', '/library', { workSlug, kind: 'following' });
}
