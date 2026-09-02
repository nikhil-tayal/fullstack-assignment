import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_FILES, SourceFile } from '../ingestion-error';
import { ParsedFile, parseFile } from '../parsing/parse-file';
import { validateDataset } from './validate';

const FIXTURES = join(__dirname, '../../../../../sample-data');

/** The date the fixtures were authored against, so future-date rules stay stable. */
const TODAY = new Date(Date.UTC(2026, 8, 2));

async function load(dir: string): Promise<Record<'entities' | 'ownership' | 'filings', ParsedFile>> {
  const parsed = {} as Record<string, ParsedFile>;
  for (const file of SOURCE_FILES) {
    const buffer = readFileSync(join(FIXTURES, dir, file));
    const result = await parseFile(file, file, buffer);
    if (!result.ok) throw new Error(`${dir}/${file} failed to parse: ${result.errors[0].message}`);
    parsed[file.replace('.csv', '')] = result.parsed;
  }
  return parsed as Record<'entities' | 'ownership' | 'filings', ParsedFile>;
}

async function errorsFor(dir: string) {
  const result = validateDataset(await load(dir), TODAY);
  return result.ok ? [] : result.errors;
}

/** The catalogue in sample-data/EXPECTED-ERRORS.md, as a table the suite can assert on. */
const EXPECTED: [SourceFile, number, string, string][] = [
  ['entities.csv', 4, 'Status Date', 'row'],
  ['entities.csv', 5, 'Domestic Entity', 'row'],
  ['entities.csv', 6, 'Entity Status', 'row'],
  ['entities.csv', 7, 'Entity Name', 'row'],
  ['entities.csv', 8, 'Formation Date', 'row'],
  ['entities.csv', 9, 'Domestic Entity', 'reference'],
  ['entities.csv', 10, 'Entity/Business ID', 'row'],
  ['entities.csv', 11, 'Global Region', 'row'],
  ['ownership.csv', 4, 'Ownership %', 'graph'],
  ['ownership.csv', 5, 'Child Entity', 'graph'],
  ['ownership.csv', 6, 'Child Entity', 'graph'],
  ['ownership.csv', 7, 'Child Entity', 'reference'],
  ['ownership.csv', 8, 'Child Entity', 'reference'],
  ['ownership.csv', 9, 'Parent Entity', 'row'],
  ['ownership.csv', 10, 'Ownership %', 'row'],
  ['ownership.csv', 11, 'Ownership %', 'row'],
  ['filings.csv', 4, 'Filed Date', 'row'],
  ['filings.csv', 5, 'Filed Date', 'row'],
  ['filings.csv', 6, 'Filing Type', 'row'],
  ['filings.csv', 7, 'Entity Name', 'reference'],
  ['filings.csv', 9, 'Due Date', 'row'],
];

describe('validateDataset', () => {
  it('accepts the dataset from the assignment brief', async () => {
    expect(await errorsFor('provided')).toEqual([]);
  });

  it('accepts the demo dataset', async () => {
    expect(await errorsFor('demo')).toEqual([]);
  });

  describe('against the defective dataset', () => {
    it('reports every planted defect, and nothing else', async () => {
      const actual = (await errorsFor('defective')).map((e) => [e.file, e.line, e.column, e.class]);
      expect(actual).toEqual(EXPECTED);
    });

    it('names the fix in every message', async () => {
      for (const error of await errorsFor('defective')) {
        // A message that only states the fault leaves the user guessing. Every one of
        // ours has to end in an instruction, which in practice means a second sentence.
        expect(error.message.length, error.message).toBeGreaterThan(30);
        expect(error.message, error.message).toMatch(/[.:] \w/);
      }
    });

    it('finds all four failure classes in one pass', async () => {
      const classes = new Set((await errorsFor('defective')).map((e) => e.class));
      expect([...classes].sort()).toEqual(['graph', 'reference', 'row']);
    });
  });
});
