import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { IngestionError, SourceFile } from '../ingestion-error';
import { FILE_COLUMNS } from './file-schema';

/** One data row, carrying the spreadsheet line it came from so errors can point at it. */
export interface SourceRow {
  /** 1-based spreadsheet line. The header is line 1, so data starts at line 2. */
  line: number;
  /** Column heading -> cell text, already trimmed. Missing trailing cells read as ''. */
  cells: Record<string, string>;
}

export interface ParsedFile {
  file: SourceFile;
  rows: SourceRow[];
}

/** Either the file parsed cleanly, or it did not and we say why. Never both. */
export type ParseResult =
  | { ok: true; parsed: ParsedFile }
  | { ok: false; errors: IngestionError[] };

const structural = (file: SourceFile, message: string, line: number | null = null): IngestionError => ({
  file,
  line,
  column: null,
  class: 'structural',
  message,
});

/**
 * Reads a .csv or .xlsx upload into rows keyed by column heading.
 *
 * Both formats are normalised to the same shape so that everything downstream —
 * validation, the graph, persistence — is written once and neither knows nor cares
 * which the reviewer uploaded.
 */
export async function parseFile(
  file: SourceFile,
  filename: string,
  buffer: Buffer,
): Promise<ParseResult> {
  const isXlsx = /\.xlsx$/i.test(filename);
  const isCsv = /\.csv$/i.test(filename);

  if (!isXlsx && !isCsv) {
    return {
      ok: false,
      errors: [
        structural(
          file,
          `Unsupported file type "${filename}". Save the file as .csv or .xlsx and upload it again.`,
        ),
      ],
    };
  }

  let grid: string[][];
  let lines: number[];
  try {
    ({ grid, lines } = isXlsx ? await readXlsx(buffer) : readCsv(buffer));
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return {
      ok: false,
      errors: [structural(file, `Could not read ${filename}: ${detail}. Re-export the file and upload it again.`)],
    };
  }

  return toRows(file, grid, lines);
}

/**
 * csv-parse is used rather than a hand-rolled split because it tracks physical lines,
 * and a quoted field may contain a newline. `info.lines` reports the line a record
 * *ends* on, so the start is derived from where the previous record finished: a row
 * whose first cell wraps over two lines has to be reported at the line the user would
 * scroll to, which is where it begins.
 *
 * Empty lines are parsed rather than skipped, precisely so that the running line count
 * stays true; the blanks are dropped afterwards.
 */
function readCsv(buffer: Buffer): { grid: string[][]; lines: number[] } {
  const records = parseCsv(buffer, {
    bom: true,
    columns: false,
    info: true,
    relax_column_count: true,
    skip_empty_lines: false,
    trim: true,
  }) as unknown as { record: string[]; info: { lines: number } }[];

  const grid: string[][] = [];
  const lines: number[] = [];
  let previousEnd = 0;

  for (const { record, info } of records) {
    const start = previousEnd + 1;
    previousEnd = info.lines;
    if (record.every((cell) => cell.trim() === '')) continue;
    grid.push(record);
    lines.push(start);
  }

  return { grid, lines };
}

/**
 * exceljs row numbers are already spreadsheet line numbers, which is exactly what an
 * error message needs to quote, so they are carried through unchanged.
 */
async function readXlsx(buffer: Buffer): Promise<{ grid: string[][]; lines: number[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('the workbook has no sheets');

  const grid: string[][] = [];
  const lines: number[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const width = Math.max(sheet.columnCount, row.cellCount);
    const values: string[] = [];
    for (let c = 1; c <= width; c++) {
      values.push(cellText(row.getCell(c)));
    }
    if (values.every((v) => v === '')) return;
    grid.push(values);
    lines.push(rowNumber);
  });

  return { grid, lines };
}

/**
 * Everything downstream validates text, so cells are reduced to the string the user
 * would see in the cell. Dates get an ISO date because Excel hands back a Date object
 * for a date-formatted cell, and formulas contribute their cached result rather than
 * their expression.
 */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text.trim();
    if ('result' in v) return String((v as { result: unknown }).result ?? '').trim();
    if ('richText' in v) return v.richText.map((r) => r.text).join('').trim();
    return '';
  }
  return String(v).trim();
}

function toRows(file: SourceFile, grid: string[][], lines: number[]): ParseResult {
  const expected = FILE_COLUMNS[file];

  if (grid.length === 0) {
    return { ok: false, errors: [structural(file, `${file} is empty. It needs a header row and at least one data row.`)] };
  }

  const header = grid[0].map((h) => h.trim());
  const headerErrors = checkHeader(file, header, expected, lines[0]);
  if (headerErrors.length > 0) return { ok: false, errors: headerErrors };

  const rows: SourceRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const raw = grid[i];
    // A row of nothing but blanks is a trailing artefact of most spreadsheet exports,
    // not something the user typed. Skipping it beats reporting ten phantom errors.
    if (raw.every((cell) => cell.trim() === '')) continue;

    const cells: Record<string, string> = {};
    expected.forEach((col, c) => {
      cells[col] = (raw[c] ?? '').trim();
    });
    rows.push({ line: lines[i], cells });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      errors: [structural(file, `${file} has a header but no data rows. Add the rows and upload it again.`)],
    };
  }

  return { ok: true, parsed: { file, rows } };
}

function checkHeader(
  file: SourceFile,
  header: string[],
  expected: readonly string[],
  line: number,
): IngestionError[] {
  const missing = expected.filter((c) => !header.includes(c));
  const unexpected = header.filter((c) => c !== '' && !expected.includes(c));

  const errors: IngestionError[] = [];
  if (missing.length > 0) {
    errors.push(
      structural(
        file,
        `${file} is missing the column${missing.length > 1 ? 's' : ''} ${quote(missing)}. Add ${
          missing.length > 1 ? 'them' : 'it'
        } to the header row.`,
        line,
      ),
    );
  }
  if (unexpected.length > 0) {
    errors.push(
      structural(
        file,
        `${file} has ${unexpected.length > 1 ? 'columns' : 'a column'} we do not recognise: ${quote(
          unexpected,
        )}. Rename or remove ${unexpected.length > 1 ? 'them' : 'it'} — the expected header is ${quote([...expected])}.`,
        line,
      ),
    );
  }
  // Order matters because cells are read positionally, so a correct set in the wrong
  // order is still a fault worth naming plainly.
  if (errors.length === 0 && expected.some((c, i) => header[i] !== c)) {
    errors.push(
      structural(
        file,
        `${file} has the right columns in the wrong order. Reorder the header row to ${quote([...expected])}.`,
        line,
      ),
    );
  }
  return errors;
}

const quote = (xs: string[]) => xs.map((x) => `"${x}"`).join(', ');
