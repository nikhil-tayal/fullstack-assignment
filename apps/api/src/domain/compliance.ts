import { ComplianceStatus, isSettled, isTerminal } from './vocabulary';

/**
 * Whole calendar days from `from` to `to`, negative once `to` has passed.
 *
 * Deliberately computed on the date parts alone. The spec says "calendar days", and a
 * wall-clock subtraction would make the answer depend on the time of day and on
 * daylight-saving transitions — so an entity could drift across the 90-day boundary
 * at 2am rather than at midnight.
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * The earliest due date still outstanding for one registration.
 *
 * "Per registration" is doing real work here: an FQ is its own registration with its
 * own filings, so it gets its own due date and its own compliance status rather than
 * inheriting the domestic entity's.
 */
export function nextFilingDueDate(
  filings: readonly { dueDate: Date; status: string }[],
): Date | null {
  const outstanding = filings
    .filter((f) => !isSettled(f.status))
    .map((f) => f.dueDate);

  if (outstanding.length === 0) return null;
  return outstanding.reduce((a, b) => (a <= b ? a : b));
}

/**
 * The compliance ladder, in the spec's own order. First match wins.
 *
 * Entity status short-circuits everything: a dissolved entity two years overdue is
 * NOT_APPLICABLE, not SUSPENDED. That is why the terminal check runs before the date
 * is even looked at.
 *
 * Boundaries are inclusive-low throughout: d = 90 is GOOD_STANDING, d = 0 is
 * FILING_DUE, d = -364 is OVERDUE, and d = -365 is the first SUSPENDED day.
 */
export function complianceStatus(
  entityStatus: string,
  nextDue: Date | null,
  today: Date,
): ComplianceStatus {
  if (isTerminal(entityStatus)) return 'NOT_APPLICABLE';
  if (nextDue === null) return 'TBD';

  const d = calendarDaysBetween(today, nextDue);

  if (d >= 90) return 'GOOD_STANDING';
  if (d >= 0) return 'FILING_DUE';
  if (d >= -364) return 'OVERDUE';
  return 'SUSPENDED';
}
