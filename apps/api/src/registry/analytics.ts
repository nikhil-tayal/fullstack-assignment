import { COMPLIANCE_STATUSES } from '../domain/vocabulary';
import { EntityRow, FilingRow, OwnershipRow, complianceFor } from './hierarchy';

/** Rows with no Global Region are their own group, not a gap to be hidden. */
export const UNASSIGNED_REGION = 'Unassigned';

export interface AnalyticsFilters {
  jurisdiction?: string;
  entityStatus?: string;
  parent?: string;
}

export interface Analytics {
  complianceBreakdown: { status: string; count: number }[];
  entityStatusByRegion: { region: string; counts: Record<string, number> }[];
  compositionByTopLevel: { name: string; subsidiaries: number; foreignQualifications: number }[];
  ownershipSplit: {
    parent: string;
    children: { name: string; percent: number; heldByOthers: number; unallocated: number }[];
  } | null;
  parentOptions: string[];
  filterOptions: { jurisdictions: string[]; entityStatuses: string[] };
}

/**
 * Every figure the analytics page draws, computed in one pass so that the page's two
 * filters cannot leave one chart describing a different population from another.
 *
 * The filters narrow which entities are counted. They deliberately do not narrow the
 * ownership split: that chart answers "how is this parent's stake divided", and
 * dropping some of its children would show a remainder that is an artefact of the
 * filter rather than a fact about the company.
 */
export function buildAnalytics(
  entities: EntityRow[],
  ownership: OwnershipRow[],
  filings: FilingRow[],
  today: Date,
  filters: AnalyticsFilters = {},
): Analytics {
  const filingsByEntity = new Map<string, FilingRow[]>();
  for (const filing of filings) {
    const list = filingsByEntity.get(filing.entityName);
    if (list) list.push(filing);
    else filingsByEntity.set(filing.entityName, [filing]);
  }

  const inScope = entities.filter(
    (e) =>
      (!filters.jurisdiction || e.jurisdiction === filters.jurisdiction) &&
      (!filters.entityStatus || e.entityStatus === filters.entityStatus),
  );

  const complianceCounts = new Map<string, number>();
  for (const entity of inScope) {
    const { status } = complianceFor(entity, filingsByEntity.get(entity.name) ?? [], today);
    complianceCounts.set(status, (complianceCounts.get(status) ?? 0) + 1);
  }
  // Ordered by the ladder rather than by size, so the chart's shape is comparable
  // between uploads and the worst statuses always sit in the same place.
  const complianceBreakdown = COMPLIANCE_STATUSES.filter((s) => complianceCounts.has(s)).map((status) => ({
    status,
    count: complianceCounts.get(status)!,
  }));

  const regions = new Map<string, Record<string, number>>();
  for (const entity of inScope) {
    const region = entity.globalRegion ?? UNASSIGNED_REGION;
    const counts = regions.get(region) ?? {};
    counts[entity.entityStatus] = (counts[entity.entityStatus] ?? 0) + 1;
    regions.set(region, counts);
  }
  const entityStatusByRegion = [...regions.entries()]
    .map(([region, counts]) => ({ region, counts }))
    .sort((a, b) => (a.region === UNASSIGNED_REGION ? 1 : b.region === UNASSIGNED_REGION ? -1 : a.region.localeCompare(b.region)));

  return {
    complianceBreakdown,
    entityStatusByRegion,
    compositionByTopLevel: composition(entities, ownership, inScope),
    ownershipSplit: ownershipSplit(ownership, filters.parent),
    parentOptions: [...new Set(ownership.map((o) => o.parentName))].sort((a, b) => a.localeCompare(b)),
    filterOptions: {
      jurisdictions: [...new Set(entities.map((e) => e.jurisdiction))].sort((a, b) => a.localeCompare(b)),
      entityStatuses: [...new Set(entities.map((e) => e.entityStatus))].sort((a, b) => a.localeCompare(b)),
    },
  };
}

/**
 * For each top-level entity, how much of the group hangs off it.
 *
 * Counted over the whole subtree rather than direct children only: a top-level entity
 * with one subsidiary that itself holds eight is not a small group, and the chart is
 * there to show relative size. Names are deduplicated because a company owned by two
 * parents inside the same group would otherwise be counted twice.
 */
function composition(
  entities: EntityRow[],
  ownership: OwnershipRow[],
  inScope: EntityRow[],
): { name: string; subsidiaries: number; foreignQualifications: number }[] {
  const scoped = new Set(inScope.map((e) => e.name));
  const owned = new Set(ownership.map((e) => e.childName));

  const childrenOf = new Map<string, string[]>();
  for (const edge of ownership) {
    const list = childrenOf.get(edge.parentName);
    if (list) list.push(edge.childName);
    else childrenOf.set(edge.parentName, [edge.childName]);
  }

  const fqsOf = new Map<string, string[]>();
  for (const entity of entities) {
    if (entity.registrationType !== 'FQ' || entity.domesticEntityName === null) continue;
    const list = fqsOf.get(entity.domesticEntityName);
    if (list) list.push(entity.name);
    else fqsOf.set(entity.domesticEntityName, [entity.name]);
  }

  return entities
    .filter((e) => e.registrationType === 'Entity' && !owned.has(e.name))
    .map((root) => {
      const subsidiaries = new Set<string>();
      const foreignQualifications = new Set<string>();

      const walk = (name: string): void => {
        for (const fq of fqsOf.get(name) ?? []) {
          if (scoped.has(fq)) foreignQualifications.add(fq);
        }
        for (const child of childrenOf.get(name) ?? []) {
          if (subsidiaries.has(child)) continue;
          if (scoped.has(child)) subsidiaries.add(child);
          walk(child);
        }
      };
      walk(root.name);

      return { name: root.name, subsidiaries: subsidiaries.size, foreignQualifications: foreignQualifications.size };
    })
    .filter((row) => scoped.has(row.name) || row.subsidiaries > 0 || row.foreignQualifications > 0)
    .sort((a, b) => b.subsidiaries + b.foreignQualifications - (a.subsidiaries + a.foreignQualifications));
}

/**
 * How much of each of its children a parent actually holds.
 *
 * Drawn as one bar per child rather than one pie across them, because the percentages
 * are per child and do not share a denominator: a parent holding 60% of one company and
 * 100% of another has not allocated 160% of anything. Each bar runs 0-100% of that
 * child and is divided three ways:
 *
 *   percent      - the selected parent's stake
 *   heldByOthers - stakes other parents in this registry hold in the same child
 *   unallocated  - the remainder, owned outside the registry
 *
 * The remainder is the point of the chart. Under 100% is legal and common, and a chart
 * that dropped it would imply the group owns these companies outright.
 */
function ownershipSplit(ownership: OwnershipRow[], parent: string | undefined) {
  if (!parent) return null;

  const totalFor = (child: string) =>
    ownership.filter((o) => o.childName === child).reduce((sum, o) => sum + Math.round(o.percent * 100), 0);

  const children = ownership
    .filter((o) => o.parentName === parent)
    .map((o) => {
      // Summed in hundredths for the same reason validation does it: 33.33 three times
      // should not leave a remainder made of floating point noise.
      const mine = Math.round(o.percent * 100);
      const total = totalFor(o.childName);
      return {
        name: o.childName,
        percent: o.percent,
        heldByOthers: (total - mine) / 100,
        unallocated: Math.max(0, 10_000 - total) / 100,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  return children.length === 0 ? null : { parent, children };
}
