import { calendarDaysBetween, complianceStatus, nextFilingDueDate } from '../domain/compliance';
import { ComplianceStatus } from '../domain/vocabulary';

/** The rows this module works from, narrowed to what the hierarchy actually needs. */
export interface EntityRow {
  name: string;
  registrationType: string;
  jurisdiction: string;
  entityType: string;
  entityStatus: string;
  statusDate: Date | null;
  formationDate: Date | null;
  businessId: string | null;
  globalRegion: string | null;
  domesticEntityName: string | null;
}

export interface OwnershipRow {
  parentName: string;
  childName: string;
  percent: number;
}

export interface FilingRow {
  entityName: string;
  dueDate: Date;
  status: string;
}

export interface EntityNode {
  name: string;
  registrationType: string;
  jurisdiction: string;
  entityType: string;
  entityStatus: string;
  statusDate: string | null;
  formationDate: string | null;
  businessId: string | null;
  globalRegion: string | null;

  complianceStatus: ComplianceStatus;
  nextFilingDueDate: string | null;
  daysToDue: number | null;

  ownershipPercent: number | null;
  subsidiaryCount: number;
  fqCount: number;
  matched: boolean;

  foreignQualifications: EntityNode[];
  subsidiaries: EntityNode[];
}

export interface Filters {
  search?: string;
  entityStatus?: string;
  complianceStatus?: string;
  jurisdiction?: string;
}

const day = (d: Date | null): string | null => (d === null ? null : d.toISOString().slice(0, 10));

/**
 * The compliance figures for one registration.
 *
 * Derived per entity row rather than per legal entity, because an FQ is a registration
 * in its own right: it files in its own jurisdiction and can fall out of good standing
 * while its domestic entity is perfectly current.
 */
export function complianceFor(
  entity: EntityRow,
  filings: FilingRow[],
  today: Date,
): { status: ComplianceStatus; nextDue: Date | null; daysToDue: number | null } {
  const nextDue = nextFilingDueDate(filings);
  return {
    status: complianceStatus(entity.entityStatus, nextDue, today),
    nextDue,
    daysToDue: nextDue === null ? null : calendarDaysBetween(today, nextDue),
  };
}

/**
 * Assembles the list page's hierarchy.
 *
 * Ownership is a directed acyclic graph, not a tree, so a company owned by two parents
 * is genuinely present in two places and is returned under both, each time carrying the
 * percentage that parent holds. Collapsing those into one row would be a smaller
 * response and a false picture of the group.
 *
 * Roots are the Entity rows nobody owns. FQs are never roots and never children: they
 * hang off their domestic entity as a second registration of it.
 */
export function buildHierarchy(
  entities: EntityRow[],
  ownership: OwnershipRow[],
  filings: FilingRow[],
  today: Date,
  filters: Filters = {},
): { topLevel: EntityNode[]; shown: number } {
  const filingsByEntity = new Map<string, FilingRow[]>();
  for (const filing of filings) {
    const list = filingsByEntity.get(filing.entityName);
    if (list) list.push(filing);
    else filingsByEntity.set(filing.entityName, [filing]);
  }

  const childrenOf = new Map<string, OwnershipRow[]>();
  for (const edge of ownership) {
    const list = childrenOf.get(edge.parentName);
    if (list) list.push(edge);
    else childrenOf.set(edge.parentName, [edge]);
  }

  const fqsOf = new Map<string, EntityRow[]>();
  for (const entity of entities) {
    if (entity.registrationType !== 'FQ' || entity.domesticEntityName === null) continue;
    const list = fqsOf.get(entity.domesticEntityName);
    if (list) list.push(entity);
    else fqsOf.set(entity.domesticEntityName, [entity]);
  }

  const byName = new Map(entities.map((e) => [e.name, e]));
  const owned = new Set(ownership.map((e) => e.childName));

  const build = (entity: EntityRow, ownershipPercent: number | null, seen: ReadonlySet<string>): EntityNode => {
    const compliance = complianceFor(entity, filingsByEntity.get(entity.name) ?? [], today);
    const edges = childrenOf.get(entity.name) ?? [];

    // Validation rejects cycles before anything is stored, so `seen` should never
    // trigger. It stays as a structural guarantee that reading the registry cannot
    // hang, whatever else goes wrong.
    const path = new Set(seen).add(entity.name);

    const subsidiaries = edges
      .filter((edge) => byName.has(edge.childName) && !path.has(edge.childName))
      .map((edge) => build(byName.get(edge.childName)!, edge.percent, path))
      .sort((a, b) => a.name.localeCompare(b.name));

    const foreignQualifications = (fqsOf.get(entity.name) ?? [])
      .map((fq) => build(fq, null, path))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      name: entity.name,
      registrationType: entity.registrationType,
      jurisdiction: entity.jurisdiction,
      entityType: entity.entityType,
      entityStatus: entity.entityStatus,
      statusDate: day(entity.statusDate),
      formationDate: day(entity.formationDate),
      businessId: entity.businessId,
      globalRegion: entity.globalRegion,
      complianceStatus: compliance.status,
      nextFilingDueDate: day(compliance.nextDue),
      daysToDue: compliance.daysToDue,
      ownershipPercent,
      subsidiaryCount: subsidiaries.length,
      fqCount: foreignQualifications.length,
      matched: matches(entity, compliance.status, filters),
      foreignQualifications,
      subsidiaries,
    };
  };

  const roots = entities
    .filter((e) => e.registrationType === 'Entity' && !owned.has(e.name))
    .map((e) => build(e, null, new Set()))
    .sort((a, b) => a.name.localeCompare(b.name));

  let shown = 0;
  const pruned = roots
    .map((root) => prune(root, (n) => (n.matched ? shown++ : undefined)))
    .filter((node): node is EntityNode => node !== null);

  return { topLevel: pruned, shown };
}

function matches(entity: EntityRow, compliance: ComplianceStatus, filters: Filters): boolean {
  if (filters.search && !entity.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
  if (filters.entityStatus && entity.entityStatus !== filters.entityStatus) return false;
  if (filters.complianceStatus && compliance !== filters.complianceStatus) return false;
  if (filters.jurisdiction && entity.jurisdiction !== filters.jurisdiction) return false;
  return true;
}

/**
 * Drops the branches that contain no match, and keeps the ones that do.
 *
 * An ancestor that does not match itself is kept when a descendant does, with
 * `matched: false`, because a subsidiary shown without its parent has lost the thing
 * the list page exists to convey: where in the group it sits.
 */
function prune(node: EntityNode, count: (n: EntityNode) => void): EntityNode | null {
  const subsidiaries = node.subsidiaries
    .map((child) => prune(child, count))
    .filter((child): child is EntityNode => child !== null);
  const foreignQualifications = node.foreignQualifications
    .map((fq) => prune(fq, count))
    .filter((fq): fq is EntityNode => fq !== null);

  if (!node.matched && subsidiaries.length === 0 && foreignQualifications.length === 0) return null;
  if (node.matched) count(node);

  return { ...node, subsidiaries, foreignQualifications };
}
