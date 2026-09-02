export const SOURCE_FILES = ['entities.csv', 'ownership.csv', 'filings.csv'] as const;
export type SourceFile = (typeof SOURCE_FILES)[number];

/**
 * The four kinds of failure, kept distinct because they mean different things to the
 * person holding the spreadsheet and because they are found at different stages.
 *
 *  structural — the file itself is unusable: unreadable, or its header is not the one
 *               we expect. Nothing inside it can be trusted, so its rows are not
 *               validated at all.
 *  row        — one cell breaks a rule that can be checked against that row alone.
 *  reference  — the row is internally fine but points at something in another file
 *               that is not there, or is there but is the wrong kind of thing.
 *  graph      — the row is fine and its references resolve, but the ownership graph
 *               as a whole rejects it: a cycle, self-ownership, an over-allocated
 *               child. Only visible once every row is in hand.
 */
export const ERROR_CLASSES = ['structural', 'row', 'reference', 'graph'] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

export interface IngestionError {
  file: SourceFile;
  /** Spreadsheet line, so the header is 1 and the first data row is 2. Null for a whole-file fault. */
  line: number | null;
  /** Column heading as it appears in the file. Null when the fault is the row or the file. */
  column: string | null;
  class: ErrorClass;
  /** Addressed to whoever owns the spreadsheet, and always naming the fix. */
  message: string;
}

/** Stable ordering: file order first, then down the sheet, then across the columns. */
export function sortErrors(errors: IngestionError[]): IngestionError[] {
  const fileRank = (f: SourceFile) => SOURCE_FILES.indexOf(f);
  return [...errors].sort(
    (a, b) =>
      fileRank(a.file) - fileRank(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      (a.column ?? '').localeCompare(b.column ?? ''),
  );
}
