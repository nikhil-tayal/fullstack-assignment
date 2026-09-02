// In production nginx serves the app and the API from the same origin, so a
// bare "/api" prefix is all the browser needs. In dev the two run on separate
// ports, hence the override.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export function apiUrl(path: string): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * A non-2xx response is not automatically a failure to swallow: the 422 body is
 * the validation report the upload page exists to render. So the parsed body
 * travels with the error rather than being collapsed into a status code.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Narrow the body once, at the call site that knows what that status means. */
  bodyAs<T>(): T {
    return this.body as T;
  }
}

/** Thrown when the request never reached the API at all. */
export class NetworkError extends Error {
  constructor(readonly cause: unknown) {
    super('The request could not be sent.');
    this.name = 'NetworkError';
  }
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A proxy or a crashed process answers in HTML; keep it rather than lose the clue.
    return text;
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch (cause) {
    throw new NetworkError(cause);
  }

  const body = await readBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, body, messageFrom(body, `Request failed (${res.status}).`));
  }
  return body as T;
}

/** Serialises a query object, dropping empty values so filters stay absent rather than blank. */
export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
