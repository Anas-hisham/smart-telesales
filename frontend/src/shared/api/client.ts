/**
 * The ONLY place that talks HTTP to the back end (smart-telesales-api).
 *  - base URL comes from VITE_API_URL (default http://localhost:3000/api/v1)
 *  - sends "Authorization: Bearer <accessToken>"
 *  - when the access token is expired (401 TOKEN_EXPIRED) it asks /auth/refresh ONCE, then repeats the request
 *  - every error leaves as an ApiError { status, code, message, details }
 */
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '');
const TOKENS_KEY = 'salesflow-auth-v1';

interface Tokens { accessToken: string; refreshToken: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: { field: string; message: string }[] = []) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------- tokens (the refresh token survives a page reload, so the person stays signed in) ----------
function loadTokens(): Tokens | null {
  try {
    const rawValue = localStorage.getItem(TOKENS_KEY);
    const storedTokens = rawValue ? JSON.parse(rawValue) as Partial<Tokens> : null;
    return storedTokens?.accessToken && storedTokens.refreshToken ? { accessToken: storedTokens.accessToken, refreshToken: storedTokens.refreshToken } : null;
  } catch { return null; }
}
let tokens: Tokens | null = loadTokens();
let onSessionLost: (() => void) | null = null;

export function setTokens(newTokens: Tokens) {
  tokens = newTokens;
  try { localStorage.setItem(TOKENS_KEY, JSON.stringify(newTokens)); } catch { /* storage blocked: the session lasts until reload */ }
}
export function clearTokens() {
  tokens = null;
  try { localStorage.removeItem(TOKENS_KEY); } catch { /* ignore */ }
}
export const hasTokens = () => !!tokens;
export const getRefreshToken = () => tokens?.refreshToken ?? null;
/** Called when the session cannot be renewed any more (the app then shows the login page). */
export function setSessionLostHandler(handler: () => void) { onSessionLost = handler; }

// ---------- refresh (one at a time: parallel requests share the same refresh) ----------
let refreshing: Promise<void> | null = null;
function refreshTokens(): Promise<void> {
  if (!refreshing) {
    refreshing = (async () => {
      if (!tokens) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in');
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }).catch(() => { throw new ApiError(0, 'NETWORK', 'Cannot reach the server'); });
      if (!response.ok) { clearTokens(); onSessionLost?.(); throw new ApiError(401, 'TOKEN_EXPIRED', 'The session has expired'); }
      const body = await response.json() as { accessToken: string; refreshToken: string };
      setTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

// ---------- the request ----------
type Query = Record<string, string | number | boolean | null | undefined>;
export interface RequestOptions { body?: unknown; query?: Query; idempotencyKey?: string; auth?: boolean }

function buildUrl(path: string, query?: Query) {
  const queryString = new URLSearchParams();
  for (const [paramKey, paramValue] of Object.entries(query ?? {})) if (paramValue !== undefined && paramValue !== null && paramValue !== '') queryString.set(paramKey, String(paramValue));
  const queryText = queryString.toString();
  return `${BASE}${path}${queryText ? `?${queryText}` : ''}`;
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  if (opts.auth !== false && tokens) headers.authorization = `Bearer ${tokens.accessToken}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, opts.query), { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

  if (response.ok) return json as T;

  const apiError = (json as { error?: { code?: string; message?: string; details?: { field: string; message: string }[] } } | null)?.error;
  const requestError = new ApiError(response.status, apiError?.code ?? 'HTTP_ERROR', apiError?.message ?? `Request failed (${response.status})`, apiError?.details);

  if (response.status === 401 && opts.auth !== false) {
    if (requestError.code === 'TOKEN_EXPIRED' && !retried && tokens) {
      await refreshTokens();                      // throws (and signs out) when the refresh token is dead too
      return request<T>(method, path, opts, true);
    }
    clearTokens();
    onSessionLost?.();
  }
  throw requestError;
}

export const get = <T>(path: string, query?: Query) => request<T>('GET', path, { query });
export const post = <T>(path: string, body?: unknown, extra: Omit<RequestOptions, 'body'> = {}) => request<T>('POST', path, { body, ...extra });
export const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body });
export const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body });
export const del = <T>(path: string) => request<T>('DELETE', path);

/** One readable sentence for an error (the first field problem is added when the server sent details). */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const firstDetail = error.details?.[0];
    return firstDetail && firstDetail.field !== 'body' ? `${error.message}: ${firstDetail.message}${firstDetail.field ? ` (${firstDetail.field})` : ''}` : error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
