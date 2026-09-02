import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { SOURCE_FILES, SourceFile } from '../ingestion-error';
import { parseFile } from './parse-file';

const FIXTURES = join(__dirname, '../../../../../sample-data');

const read = (dir: string, file: SourceFile) => readFileSync(join(FIXTURES, dir, file));

async function parse(dir: string, file: SourceFile, filename: string = file) {
  return parseFile(file, filename, read(dir, file));
}

describe('parseFile', () => {
  it('reads the provided dataset, with the header as line 1 and data from line 2', async () => {
    const result = await parse('provided', 'entities.csv');
    if (!result.ok) throw new Error(result.errors[0].message);

    expect(result.parsed.rows).toHaveLength(5);
    expect(result.parsed.rows[0].line).toBe(2);
    expect(result.parsed.rows[0].cells['Entity Name']).toBe('Harrier Group Inc');
    expect(result.parsed.rows[0].cells['Status Date']).toBe('');
  });

  it('keeps the true spreadsheet line when a quoted field spans two lines', async () => {
    const csv = Buffer.from(
      'Parent Entity,Child Entity,Ownership %\n' +
        '"Harrier\nGroup Inc",Harrier Systems LLC,100\n' +
        'Harrier Group Inc,Harrier Freight LLC,60\n',
    );
    const result = await parseFile('ownership.csv', 'ownership.csv', csv);
    if (!result.ok) throw new Error(result.errors[0].message);

    // The second data row is physically on line 4, and that is the line the user would
    // have to scroll to. Reporting it as row 3 would send them to the wrong place.
    expect(result.parsed.rows.map((r) => r.line)).toEqual([2, 4]);
  });

  describe('structural faults', () => {
    it('reports a renamed column and an unrecognised one, without reading any rows', async () => {
      const result = await parse('defective-structural', 'entities.csv');
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors.every((e) => e.class === 'structural')).toBe(true);
      expect(result.errors.map((e) => e.message).join('\n')).toContain('"Entity/Business ID"');
      expect(result.errors.map((e) => e.message).join('\n')).toContain('"Business ID"');
    });

    it('reports the right columns in the wrong order', async () => {
      const result = await parse('defective-structural', 'ownership.csv');
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toMatch(/wrong order/);
    });

    it('reports a file that has a header but no rows', async () => {
      const result = await parse('defective-structural', 'filings.csv');
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors[0].message).toMatch(/no data rows/);
    });

    it('rejects a file that is neither .csv nor .xlsx', async () => {
      const result = await parse('provided', 'entities.csv', 'entities.numbers');
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors[0].message).toMatch(/Save the file as \.csv or \.xlsx/);
    });
  });

  describe('.xlsx', () => {
    /** The same rows as the CSV fixture, so both formats can be asserted to agree. */
    async function toXlsx(file: SourceFile): Promise<Buffer> {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      for (const line of read('provided', file).toString().trim().split('\n')) {
        sheet.addRow(line.split(','));
      }
      return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    it.each(SOURCE_FILES)('reads %s identically to the CSV', async (file) => {
      const fromCsv = await parse('provided', file);
      const fromXlsx = await parseFile(file, file.replace('.csv', '.xlsx'), await toXlsx(file));
      if (!fromCsv.ok || !fromXlsx.ok) throw new Error('both formats should parse');

      expect(fromXlsx.parsed.rows).toEqual(fromCsv.parsed.rows);
    });
  });
});
