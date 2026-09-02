// The vocabulary of the source spreadsheets, kept in one place so the parser, the
// validators and the error messages all quote the same strings back to the user.
//
// These deliberately live here rather than as database enums. The spec draws a line
// between parsing, validation and persistence, and "is this a valid Entity Status"
// is a validation question: it must be answerable — and reportable against a cell —
// before anything reaches the database.

export const REGISTRATION_TYPES = ['Entity', 'FQ'] as const;
export type RegistrationType = (typeof REGISTRATION_TYPES)[number];

export const ENTITY_TYPES = [
  'Corporation',
  'Limited Liability Company',
  'Limited Partnership',
  'General Partnership',
  'Nonprofit',
  'Trust',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_STATUSES = [
  'In Formation',
  'Active',
  'Revoked/Terminated',
  'Merged/Acquired',
  'Divested/Sold',
  'Dormant',
  'Dissolved',
] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

// A terminal entity no longer files. Two separate rules in the spec depend on exactly
// this set: Status Date is "required unless status is In Formation or Active", and the
// compliance ladder's first rung is NOT_APPLICABLE.
//
// The ladder writes these names in shorthand — "Divested", "Merged" — while the column
// definition spells them "Divested/Sold", "Merged/Acquired". They are the same five
// statuses: the two lists agree in count and in every unambiguous member, and the
// Status Date rule independently pins the set to "everything except In Formation and
// Active". The column spelling is authoritative because that is what a file contains.
export const TERMINAL_ENTITY_STATUSES = [
  'Revoked/Terminated',
  'Merged/Acquired',
  'Divested/Sold',
  'Dormant',
  'Dissolved',
] as const;

export function isTerminal(status: string): boolean {
  return (TERMINAL_ENTITY_STATUSES as readonly string[]).includes(status);
}

export const FILING_TYPES = [
  'Annual Report',
  'Statement of Information',
  'Franchise Tax',
  'Biennial Statement',
] as const;
export type FilingType = (typeof FILING_TYPES)[number];

export const FILING_STATUSES = [
  'Not Started',
  'In Progress',
  'Submitted',
  'Filed',
  'Rejected',
  'Canceled',
] as const;
export type FilingStatus = (typeof FILING_STATUSES)[number];

// A filing in one of these states no longer drives a due date: it is done, or it is
// off the table. Everything else — including Submitted and Rejected — still counts.
export const SETTLED_FILING_STATUSES = ['Filed', 'Canceled'] as const;

export function isSettled(status: string): boolean {
  return (SETTLED_FILING_STATUSES as readonly string[]).includes(status);
}

export const GLOBAL_REGIONS = [
  'North America',
  'Asia Pacific',
  'Europe Middle East Africa',
  'Latin America',
  'European Economic Area',
] as const;
export type GlobalRegion = (typeof GLOBAL_REGIONS)[number];

export const COMPLIANCE_STATUSES = [
  'GOOD_STANDING',
  'FILING_DUE',
  'OVERDUE',
  'SUSPENDED',
  'TBD',
  'NOT_APPLICABLE',
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];
