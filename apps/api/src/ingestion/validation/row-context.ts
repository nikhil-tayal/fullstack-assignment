import { ErrorClass, IngestionError, SourceFile } from '../ingestion-error';
import { SourceRow } from '../parsing/parse-file';
import { Parsed } from './values';

/**
 * Collects the faults found in one row while reading its cells.
 *
 * Row validation never stops at the first problem: a sheet with three bad cells in a
 * row should report three errors, not send the user round three upload cycles. The
 * row is dropped only at the end, and only if something in it actually failed.
 */
export class RowContext {
  private readonly errors: IngestionError[] = [];

  constructor(
    private readonly file: SourceFile,
    private readonly row: SourceRow,
  ) {}

  get line(): number {
    return this.row.line;
  }

  raw(column: string): string {
    return this.row.cells[column] ?? '';
  }

  get failed(): boolean {
    return this.errors.length > 0;
  }

  drain(): IngestionError[] {
    return this.errors;
  }

  add(column: string | null, message: string, cls: ErrorClass = 'row'): void {
    this.errors.push({ file: this.file, line: this.row.line, column, class: cls, message });
  }

  /** A required cell: absent is a fault, and so is a value the parser rejects. */
  required<T>(column: string, parse: (text: string) => Parsed<T>): T | null {
    const text = this.raw(column);
    if (text === '') {
      this.add(column, `${column} is required. Fill in the cell on this row`);
      return null;
    }
    const result = parse(text);
    if (!result.ok) {
      this.add(column, result.reason);
      return null;
    }
    return result.value;
  }

  /** An optional cell: absent is fine, but a value that is present must still be valid. */
  optional<T>(column: string, parse: (text: string) => Parsed<T>): T | null {
    const text = this.raw(column);
    if (text === '') return null;
    const result = parse(text);
    if (!result.ok) {
      this.add(column, result.reason);
      return null;
    }
    return result.value;
  }

  text(column: string): string | null {
    const text = this.raw(column);
    return text === '' ? null : text;
  }
}
