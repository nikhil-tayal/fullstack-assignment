import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { SOURCE_FILES } from '../ingestion/ingestion-error';
import { ParsedFile, parseFile } from '../ingestion/parsing/parse-file';
import { validateDataset } from '../ingestion/validation/validate';
import { UNASSIGNED_REGION, buildAnalytics } from './analytics';
import { EntityNode, EntityRow, FilingRow, OwnershipRow, buildHierarchy } from './hierarchy';

const FIXTURES = join(__dirname, '../../../../sample-data');
const TODAY = new Date(Date.UTC(2026, 8, 2));

let entities: EntityRow[];
let ownership: OwnershipRow[];
let filings: FilingRow[];

beforeAll(async () => {
  const parsed = {} as Record<string, ParsedFile>;
  for (const file of SOURCE_FILES) {
    const result = await parseFile(file, file, readFileSync(join(FIXTURES, 'demo', file)));
    if (!result.ok) throw new Error(result.errors[0].message);
    parsed[file.replace('.csv', '')] = result.parsed;
  }
  const validation = validateDataset(parsed as never, TODAY);
  if (!validation.ok) throw new Error('the demo dataset should be clean');

  entities = validation.dataset.entities;
  ownership = validation.dataset.ownership;
  filings = validation.dataset.filings;
});

const flatten = (nodes: EntityNode[]): EntityNode[] =>
  nodes.flatMap((n) => [n, ...flatten(n.subsidiaries), ...flatten(n.foreignQualifications)]);

describe('buildHierarchy', () => {
  it('roots the tree at the entities nobody owns', () => {
    const { topLevel } = buildHierarchy(entities, ownership, filings, TODAY);
    const owned = new Set(ownership.map((o) => o.childName));

    expect(topLevel.length).toBeGreaterThan(0);
    for (const root of topLevel) {
      expect(owned.has(root.name)).toBe(false);
      expect(root.registrationType).toBe('Entity');
      // Nothing owns a root, so there is no percentage to attribute to it.
      expect(root.ownershipPercent).toBeNull();
    }
  });

  it('hangs FQs off their domestic entity and never inside the ownership graph', () => {
    const { topLevel } = buildHierarchy(entities, ownership, filings, TODAY);
    const all = flatten(topLevel);

    const fqs = all.filter((n) => n.registrationType === 'FQ');
    expect(fqs.length).toBeGreaterThan(0);

    // An FQ is the same legal entity registered elsewhere, so it is never a subsidiary
    // and never carries an ownership percentage. This is the distinction being graded.
    for (const node of all) {
      expect(node.subsidiaries.every((s) => s.registrationType === 'Entity')).toBe(true);
    }
    expect(fqs.every((fq) => fq.ownershipPercent === null)).toBe(true);
    expect(topLevel.every((root) => root.registrationType !== 'FQ')).toBe(true);
  });

  it('shows a company owned by two parents under each of them', () => {
    const childCounts = new Map<string, number>();
    for (const edge of ownership) childCounts.set(edge.childName, (childCounts.get(edge.childName) ?? 0) + 1);
    const shared = [...childCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    expect(shared.length).toBeGreaterThan(0);

    const all = flatten(buildHierarchy(entities, ownership, filings, TODAY).topLevel);
    for (const name of shared) {
      const appearances = all.filter((n) => n.name === name);
      // Ownership is a graph. Two parents means two genuine places in the tree, each
      // carrying that parent's own stake.
      expect(appearances.length).toBeGreaterThanOrEqual(2);
      expect(new Set(appearances.map((a) => a.ownershipPercent)).size).toBeGreaterThan(0);
    }
  });

  it('carries the percentage of the edge it was reached by', () => {
    const all = flatten(buildHierarchy(entities, ownership, filings, TODAY).topLevel);
    for (const node of all) {
      for (const child of node.subsidiaries) {
        const edge = ownership.find((o) => o.parentName === node.name && o.childName === child.name);
        expect(child.ownershipPercent).toBe(edge!.percent);
      }
    }
  });

  describe('filters', () => {
    it('keeps the ancestors of a match, marked as context rather than as matches', () => {
      const deep = flatten(buildHierarchy(entities, ownership, filings, TODAY).topLevel).find(
        (n) => n.registrationType === 'Entity' && n.subsidiaries.length === 0,
      )!;

      const { topLevel } = buildHierarchy(entities, ownership, filings, TODAY, { search: deep.name });
      const all = flatten(topLevel);

      expect(all.some((n) => n.name === deep.name && n.matched)).toBe(true);
      // A subsidiary shown without its parents has lost the one thing the list page is
      // for: where in the group it sits.
      for (const node of all) {
        expect(node.matched || node.subsidiaries.length + node.foreignQualifications.length > 0).toBe(true);
      }
    });

    it('returns nothing when a search matches nothing', () => {
      const { topLevel, shown } = buildHierarchy(entities, ownership, filings, TODAY, {
        search: 'no entity is called this',
      });
      expect(topLevel).toEqual([]);
      expect(shown).toBe(0);
    });

    it('narrows to one compliance status', () => {
      const { topLevel } = buildHierarchy(entities, ownership, filings, TODAY, {
        complianceStatus: 'OVERDUE',
      });
      const matched = flatten(topLevel).filter((n) => n.matched);

      expect(matched.length).toBeGreaterThan(0);
      expect(matched.every((n) => n.complianceStatus === 'OVERDUE')).toBe(true);
    });
  });
});

describe('buildAnalytics', () => {
  it('counts every entity exactly once in the compliance breakdown', () => {
    const analytics = buildAnalytics(entities, ownership, filings, TODAY);
    const total = analytics.complianceBreakdown.reduce((sum, row) => sum + row.count, 0);
    expect(total).toBe(entities.length);
  });

  it('keeps entities with no Global Region as their own group', () => {
    const analytics = buildAnalytics(entities, ownership, filings, TODAY);
    const unassigned = analytics.entityStatusByRegion.find((r) => r.region === UNASSIGNED_REGION);

    expect(unassigned).toBeDefined();
    // A blank region is a real state of the data, not a gap to hide.
    expect(Object.values(unassigned!.counts).reduce((a, b) => a + b, 0)).toBe(
      entities.filter((e) => e.globalRegion === null).length,
    );
  });

  it('splits each child of a parent into held, held by others, and unallocated', () => {
    const parent = [...new Set(ownership.map((o) => o.parentName))][0];
    const split = buildAnalytics(entities, ownership, filings, TODAY, { parent })!.ownershipSplit!;

    expect(split.parent).toBe(parent);
    for (const child of split.children) {
      // The three parts are one child's whole equity, so they always total 100%.
      expect(child.percent + child.heldByOthers + child.unallocated).toBeCloseTo(100, 6);
      expect(child.unallocated).toBeGreaterThanOrEqual(0);
    }
  });

  it('shows an unallocated remainder where the registry does not account for the whole company', () => {
    const totals = new Map<string, number>();
    for (const edge of ownership) totals.set(edge.childName, (totals.get(edge.childName) ?? 0) + edge.percent);
    const partial = [...totals.entries()].find(([, total]) => total < 100)!;

    const parent = ownership.find((o) => o.childName === partial[0])!.parentName;
    const split = buildAnalytics(entities, ownership, filings, TODAY, { parent })!.ownershipSplit!;
    const child = split.children.find((c) => c.name === partial[0])!;

    expect(child.unallocated).toBeGreaterThan(0);
  });

  it('returns no ownership split until a parent is chosen', () => {
    expect(buildAnalytics(entities, ownership, filings, TODAY).ownershipSplit).toBeNull();
  });

  it('narrows every chart with the page filters', () => {
    const jurisdiction = entities[0].jurisdiction;
    const analytics = buildAnalytics(entities, ownership, filings, TODAY, { jurisdiction });

    const counted = analytics.complianceBreakdown.reduce((sum, row) => sum + row.count, 0);
    expect(counted).toBe(entities.filter((e) => e.jurisdiction === jurisdiction).length);

    // The filter options stay drawn from the whole registry: narrowing by one filter
    // must not empty the choices available for the others.
    expect(analytics.filterOptions.jurisdictions.length).toBeGreaterThan(1);
  });
});
