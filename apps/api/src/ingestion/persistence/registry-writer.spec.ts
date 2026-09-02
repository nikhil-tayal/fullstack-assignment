import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { SOURCE_FILES } from '../ingestion-error';
import { ParsedFile, parseFile } from '../parsing/parse-file';
import { ValidDataset } from '../validation/records';
import { validateDataset } from '../validation/validate';
import { RegistryWriter } from './registry-writer';

const FIXTURES = join(__dirname, '../../../../../sample-data');
const TODAY = new Date(Date.UTC(2026, 8, 2));

let dir: string;
let prisma: PrismaClient;
let writer: RegistryWriter;

async function datasetFrom(fixture: string): Promise<ValidDataset> {
  const parsed = {} as Record<string, ParsedFile>;
  for (const file of SOURCE_FILES) {
    const result = await parseFile(file, file, readFileSync(join(FIXTURES, fixture, file)));
    if (!result.ok) throw new Error(result.errors[0].message);
    parsed[file.replace('.csv', '')] = result.parsed;
  }
  const validation = validateDataset(parsed as never, TODAY);
  if (!validation.ok) throw new Error(`${fixture} should be clean`);
  return validation.dataset;
}

beforeAll(async () => {
  // A throwaway database per run, so the suite never touches the dev registry and two
  // runs cannot interfere with each other.
  dir = mkdtempSync(join(tmpdir(), 'registry-test-'));
  prisma = new PrismaClient({ datasources: { db: { url: `file:${join(dir, 'test.db')}` } } });

  // The schema comes from the committed migrations, applied statement by statement, so
  // the suite exercises the same tables production has rather than a second definition
  // that could drift away from them.
  const migrations = join(__dirname, '../../../prisma/migrations');
  for (const name of readdirSync(migrations, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()) {
    const sql = readFileSync(join(migrations, name, 'migration.sql'), 'utf8');
    for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }

  writer = new RegistryWriter(prisma as unknown as PrismaService);
}, 30_000);

afterAll(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await prisma.filing.deleteMany();
  await prisma.ownership.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.upload.deleteMany();
});

describe('RegistryWriter', () => {
  it('stores every row of the dataset', async () => {
    const dataset = await datasetFrom('demo');
    const result = await writer.replace(dataset);

    expect(result.changed).toBe(true);
    await expect(prisma.entity.count()).resolves.toBe(dataset.entities.length);
    await expect(prisma.ownership.count()).resolves.toBe(dataset.ownership.length);
    await expect(prisma.filing.count()).resolves.toBe(dataset.filings.length);
  });

  it('keeps FQs out of the ownership graph', async () => {
    await writer.replace(await datasetFrom('demo'));

    const fqNames = (
      await prisma.entity.findMany({ where: { registrationType: 'FQ' }, select: { name: true } })
    ).map((e) => e.name);
    expect(fqNames.length).toBeGreaterThan(0);

    // An FQ is the same legal entity registered elsewhere, so it must appear on
    // neither side of an ownership edge no matter how the data is reshaped.
    await expect(
      prisma.ownership.count({ where: { OR: [{ parentName: { in: fqNames } }, { childName: { in: fqNames } }] } }),
    ).resolves.toBe(0);
  });

  it('does not duplicate anything when the same files are uploaded again', async () => {
    const dataset = await datasetFrom('demo');
    const first = await writer.replace(dataset);
    const second = await writer.replace(await datasetFrom('demo'));

    expect(first.changed).toBe(true);
    // The second upload carries the same registry, so there is nothing to do.
    expect(second.changed).toBe(false);
    await expect(prisma.entity.count()).resolves.toBe(dataset.entities.length);
    await expect(prisma.ownership.count()).resolves.toBe(dataset.ownership.length);
    await expect(prisma.upload.count()).resolves.toBe(1);
  });

  it('replaces the previous registry rather than merging into it', async () => {
    await writer.replace(await datasetFrom('demo'));
    const smaller = await datasetFrom('provided');
    const result = await writer.replace(smaller);

    expect(result.changed).toBe(true);
    // Rows the user removed from the spreadsheet are gone, not left behind as orphans.
    await expect(prisma.entity.count()).resolves.toBe(smaller.entities.length);
    await expect(prisma.upload.count()).resolves.toBe(1);
  });

  it('leaves the previous registry intact when the write fails part-way', async () => {
    const good = await datasetFrom('provided');
    await writer.replace(good);

    // A filing pointing at an entity that is not in the same dataset breaks the
    // foreign key mid-transaction. Validation would never let this through; the point
    // is that if anything did fail, the transaction takes the whole write back.
    const broken: ValidDataset = {
      ...good,
      filings: [...good.filings, { ...good.filings[0], entityName: 'Nowhere Holdings Ltd' }],
    };
    await expect(writer.replace(broken)).rejects.toThrow();

    await expect(prisma.entity.count()).resolves.toBe(good.entities.length);
    await expect(prisma.filing.count()).resolves.toBe(good.filings.length);
    await expect(prisma.upload.count()).resolves.toBe(1);
  });
});
