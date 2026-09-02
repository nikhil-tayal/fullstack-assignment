/**
 * Cell-level parsers. Each returns either a value or the reason it could not be read,
 * phrased for the person holding the spreadsheet. Nothing here knows about files,
 * lines or columns — the callers attach those.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (reason: string): Parsed<never> => ({ ok: false, reason });

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * The spec permits YYYY-MM-DD and MM/DD/YYYY and nothing else. Both are accepted, but
 * the ambiguity is not: 03/04/2026 is read as March 4th, because MM/DD is what the
 * spec names. Dates are built at UTC midnight so day arithmetic never drifts across a
 * timezone or a DST boundary.
 */
export function parseDate(text: string): Parsed<Date> {
  const iso = ISO.exec(text);
  const us = US.exec(text);
  if (!iso && !us) {
    return fail(`"${text}" is not a date we can read. Use YYYY-MM-DD (for example 2026-03-04) or MM/DD/YYYY`);
  }

  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : [Number(us![3]), Number(us![1]), Number(us![2])];

  const date = new Date(Date.UTC(y, m - 1, d));
  // Round-tripping catches the dates that look well-formed but do not exist, such as
  // 2026-02-30, which the Date constructor would silently roll forward to March 2nd.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return fail(`"${text}" is not a real calendar date`);
  }
  return ok(date);
}

/** Ownership %: 0 < x <= 100, at most two decimals. Each rule fails with its own words. */
export function parsePercent(text: string): Parsed<number> {
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return fail(`"${text}" is not a number. Enter a percentage such as 60 or 24.5, without a % sign`);
  }
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  if (decimals > 2) {
    return fail(`"${text}" has ${decimals} decimal places. Round it to at most 2`);
  }
  const value = Number(text);
  if (value <= 0) return fail('Ownership % must be greater than 0. Remove the row if there is no ownership to record');
  if (value > 100) return fail(`Ownership % cannot exceed 100. Change ${text} to 100 or less`);
  return ok(value);
}

/**
 * "Country" or "Country/State". Deliberately shallow — we are not holding a gazetteer,
 * so this checks the shape the spec fixes and leaves the names to the user.
 */
export function parseJurisdiction(text: string): Parsed<string> {
  const parts = text.split('/');
  if (parts.length > 2 || parts.some((p) => p.trim() === '')) {
    return fail(
      `"${text}" is not a jurisdiction we can read. Use a country, or a country and state separated by one slash, such as "United States/Delaware"`,
    );
  }
  return ok(parts.map((p) => p.trim()).join('/'));
}

/** Membership against a closed vocabulary, with the permitted values spelled out. */
export function parseEnum<T extends string>(text: string, allowed: readonly T[], label: string): Parsed<T> {
  if ((allowed as readonly string[]).includes(text)) return ok(text as T);
  const near = closest(text, allowed);
  const hint = near ? ` Did you mean "${near}"?` : '';
  return fail(`"${text}" is not a valid ${label}.${hint} Use one of: ${allowed.join(', ')}`);
}

/**
 * A one-edit-away suggestion, which is what typos in a hand-maintained sheet almost
 * always are ("Actve" for "Active"). Anything further off gets no guess, because a
 * wrong suggestion is worse than none.
 */
function closest<T extends string>(text: string, allowed: readonly T[]): T | null {
  const lower = text.toLowerCase();
  let best: T | null = null;
  let bestDistance = 3;
  for (const candidate of allowed) {
    const d = editDistance(lower, candidate.toLowerCase());
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}
