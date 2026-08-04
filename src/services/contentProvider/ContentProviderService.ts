/**
 * Content-provider connector for reader-facing sites built on the app-manganyx
 * repository (white-label MangaNYX instances). The user connects by entering only
 * the site's domain; the app derives the App API host as `https://app.{domain}/v1`,
 * per the app-manganyx App API contract.
 */
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'contentProvider.manganyx.session';
const REQUEST_TIMEOUT_MS = 10000;

export interface ContentProviderUser {
  id: string;
  name: string;
  email: string;
  role: string;
  slug: string | null;
  isPremium: boolean;
  avatarUrl: string | null;
}

export interface ContentProviderSession {
  providerId: string;
  domain: string;
  baseUrl: string;
  token: string;
  expiresAt: string;
  user: ContentProviderUser;
}

export interface ContentProviderService {
  getProviderId(): string;
  getDisplayName(): string;
  getSession(): Promise<ContentProviderSession | null>;
  connect(domain: string, email: string, password: string): Promise<ContentProviderSession>;
  disconnect(): Promise<void>;
}

export class ProviderConnectionError extends Error {
  code: string;

  constructor(message: string, code: string = 'connection_error') {
    super(message);
    this.code = code;
  }
}

type LoginResponseBody = {
  data: {
    token: string;
    expiresAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      slug: string | null;
      isPremium: boolean;
      avatarUrl: string | null;
    };
  };
};

type ErrorResponseBody = {
  error: { code: string; message: string };
};

/** Strips protocol/path/common subdomain prefixes so the user can paste almost anything. */
function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.split('/')[0] ?? '';
  value = value.replace(/:\d+$/, '');
  value = value.replace(/^www\./, '');
  value = value.replace(/^app\./, '');

  const isValidHostname = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value);
  if (!value || !isValidHostname) {
    throw new ProviderConnectionError(
      'Domínio inválido. Digite apenas o domínio do site, ex: "meusite.com".',
      'invalid_domain',
    );
  }
  return value;
}

function buildBaseUrl(domain: string): string {
  return `https://app.${domain}/v1`;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class ManganyxContentProviderService implements ContentProviderService {
  getProviderId(): string {
    return 'manganyx';
  }

  getDisplayName(): string {
    return 'Site conectado';
  }

  async getSession(): Promise<ContentProviderSession | null> {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ContentProviderSession;
    } catch {
      return null;
    }
  }

  async connect(domainInput: string, email: string, password: string): Promise<ContentProviderSession> {
    const domain = normalizeDomain(domainInput);
    const baseUrl = buildBaseUrl(domain);
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      throw new ProviderConnectionError('Informe e-mail e senha.', 'validation_error');
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(`${baseUrl}/auth/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
    } catch {
      throw new ProviderConnectionError(
        `Não foi possível conectar a "${domain}". Verifique o domínio e sua conexão.`,
        'connection_error',
      );
    }

    const body = await parseJsonSafe(response);

    if (!response.ok) {
      if (response.status >= 500) {
        throw new ProviderConnectionError(
          'O servidor deste site está com um problema técnico no momento. Tente novamente mais tarde.',
          'server_error',
        );
      }
      const errorBody = body as ErrorResponseBody | null;
      throw new ProviderConnectionError(
        errorBody?.error?.message ?? 'Não foi possível entrar com essas credenciais.',
        errorBody?.error?.code ?? 'unauthorized',
      );
    }

    const parsed = body as LoginResponseBody | null;
    const user = parsed?.data?.user;
    const token = parsed?.data?.token;
    if (!user || !token) {
      throw new ProviderConnectionError('Resposta inesperada do servidor.', 'invalid_response');
    }

    const session: ContentProviderSession = {
      providerId: this.getProviderId(),
      domain,
      baseUrl,
      token,
      expiresAt: parsed.data.expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        slug: user.slug ?? null,
        isPremium: user.isPremium,
        avatarUrl: user.avatarUrl ?? null,
      },
    };

    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async disconnect(): Promise<void> {
    const session = await this.getSession();
    if (session) {
      try {
        await fetchWithTimeout(`${session.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
        });
      } catch {
        // Best-effort: still clear the local session even if the server call fails.
      }
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

export const contentProviderService: ContentProviderService = new ManganyxContentProviderService();
