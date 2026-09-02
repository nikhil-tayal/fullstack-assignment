/**
 * The wire shapes from docs/API.md, transcribed once. Every page imports from
 * here so a contract change is a single edit rather than a hunt.
 */

export type RegistrationType = 'Entity' | 'FQ';

export const COMPLIANCE_STATUSES = [
  'GOOD_STANDING',
  'FILING_DUE',
  'OVERDUE',
  'SUSPENDED',
  'NOT_APPLICABLE',
  'TBD',
] as const;

export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

/** Ladder order, worst first — the order a reader of this product cares about. */
export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  GOOD_STANDING: 'Good standing',
  FILING_DUE: 'Filing due',
  OVERDUE: 'Overdue',
  SUSPENDED: 'Suspended',
  NOT_APPLICABLE: 'Not applicable',
  TBD: 'To be determined',
};

// ---------------------------------------------------------------------------
// POST /api/uploads
// ---------------------------------------------------------------------------

export const SOURCE_FILES = ['entities.csv', 'ownership.csv', 'filings.csv'] as const;
export type SourceFile = (typeof SOURCE_FILES)[number];

/** The three multipart field names the endpoint expects, in submission order. */
export const UPLOAD_FIELDS = ['entities', 'ownership', 'filings'] as const;
export type UploadField = (typeof UPLOAD_FIELDS)[number];

export interface UploadCounts {
  entities: number;
  ownership: number;
  filings: number;
}

/** 200. `changed: false` means the files match what is already stored. */
export interface UploadAccepted {
  message: string;
  changed: boolean;
  counts: UploadCounts;
}

/** 400 — one of the three files was not attached. */
export interface UploadMissingFiles {
  message: string;
  missing: UploadField[];
}

export const ERROR_CLASSES = ['structural', 'row', 'reference', 'graph'] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

/** The headings docs/API.md fixes for each class, and what each one means. */
export const ERROR_CLASS_HEADINGS: Record<ErrorClass, string> = {
  structural: 'The file itself',
  row: 'Individual rows',
  reference: 'Names that do not match',
  graph: 'The ownership graph',
};

export const ERROR_CLASS_DESCRIPTIONS: Record<ErrorClass, string> = {
  structural: 'Wrong or missing columns; the rows could not be read',
  row: 'One cell breaks a rule',
  reference: 'A row points at something in another file',
  graph: 'Cycles, self-ownership, over-allocated children',
};

export interface IngestionError {
  file: SourceFile;
  /** Spreadsheet line, so the header is 1. Null when the whole file is at fault. */
  line: number | null;
  /** Null when the fault is the row or the file rather than one cell. */
  column: string | null;
  class: ErrorClass;
  /** Already written for the spreadsheet's owner. Render verbatim. */
  message: string;
}

/** 422 — the files were read but cannot be accepted. Nothing was written. */
export interface UploadRejected {
  message: string;
  summary: { total: number; byClass: Record<ErrorClass, number> };
  errors: IngestionError[];
}

// ---------------------------------------------------------------------------
// GET /api/registry/status
// ---------------------------------------------------------------------------

export interface RegistryStatus {
  hasData: boolean;
  uploadedAt: string | null;
  counts: UploadCounts;
}

// ---------------------------------------------------------------------------
// GET /api/registry/entities
// ---------------------------------------------------------------------------

export interface EntityNode {
  name: string;
  registrationType: RegistrationType;
  jurisdiction: string;
  entityType: string;
  entityStatus: string;
  statusDate: string | null;
  formationDate: string | null;
  businessId: string | null;
  globalRegion: string | null;

  complianceStatus: ComplianceStatus;
  nextFilingDueDate: string | null;
  /** Calendar days from today; negative once passed. Null when there is no due date. */
  daysToDue: number | null;

  /** Present only on subsidiary rows: the share this parent holds. Null on roots and FQs. */
  ownershipPercent: number | null;
  /** Direct children only. */
  subsidiaryCount: number;
  fqCount: number;
  /** True when this node itself satisfies the filters. */
  matched: boolean;

  foreignQualifications: EntityNode[];
  subsidiaries: EntityNode[];
}

export interface EntityTotals {
  topLevel: number;
  entities: number;
  foreignQualifications: number;
  shown: number;
}

export interface EntityFilterOptions {
  jurisdictions: string[];
  entityStatuses: string[];
  complianceStatuses: ComplianceStatus[];
}

export interface EntitiesResponse {
  topLevel: EntityNode[];
  totals: EntityTotals;
  filterOptions: EntityFilterOptions;
}

/** Query parameters for the list page; all optional, all combinable. */
export interface EntityQuery {
  search?: string;
  entityStatus?: string;
  complianceStatus?: ComplianceStatus;
  jurisdiction?: string;
}

// ---------------------------------------------------------------------------
// GET /api/analytics
// ---------------------------------------------------------------------------

export interface ComplianceBreakdownItem {
  status: ComplianceStatus;
  count: number;
}

export interface RegionStatusCounts {
  /** The literal "Unassigned" for rows with no Global Region — a real state, not a gap. */
  region: string;
  counts: Record<string, number>;
}

export interface CompositionItem {
  name: string;
  subsidiaries: number;
  foreignQualifications: number;
}

/**
 * One bar per child, never one pie across them: percentages are capped per child
 * and share no denominator, so a parent holding 60% of one company and 100% of
 * another has not allocated 160% of anything.
 */
export interface OwnershipSplit {
  parent: string;
  children: OwnershipSplitChild[];
}

/** The three parts are one child's whole equity and always sum to 100. */
export interface OwnershipSplitChild {
  name: string;
  /** The selected parent's own stake. */
  percent: number;
  /** Stakes other parents in this registry hold in the same child. */
  heldByOthers: number;
  /** The remainder, owned outside the registry. Frequently non-zero, never negative. */
  unallocated: number;
}

export interface AnalyticsFilterOptions {
  jurisdictions: string[];
  entityStatuses: string[];
}

export interface AnalyticsResponse {
  complianceBreakdown: ComplianceBreakdownItem[];
  entityStatusByRegion: RegionStatusCounts[];
  compositionByTopLevel: CompositionItem[];
  /** Null when no `parent` is given or the registry has no ownership at all. */
  ownershipSplit: OwnershipSplit | null;
  parentOptions: string[];
  filterOptions: AnalyticsFilterOptions;
}

export interface AnalyticsQuery {
  jurisdiction?: string;
  entityStatus?: string;
  parent?: string;
}
