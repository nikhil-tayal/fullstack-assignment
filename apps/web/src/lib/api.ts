// In production nginx serves the app and the API from the same origin, so a
// bare "/api" prefix is all the browser needs. In dev the two run on separate
// ports, hence the override.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export function apiUrl(path: string): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
