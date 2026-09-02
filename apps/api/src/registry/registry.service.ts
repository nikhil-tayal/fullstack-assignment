import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Analytics, AnalyticsFilters, buildAnalytics } from './analytics';
import { EntityNode, EntityRow, Filters, FilingRow, OwnershipRow, buildHierarchy } from './hierarchy';

interface Registry {
  entities: EntityRow[];
  ownership: OwnershipRow[];
  filings: FilingRow[];
}

@Injectable()
export class RegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    const [upload, entities, ownership, filings] = await Promise.all([
      this.prisma.upload.findFirst({ orderBy: { createdAt: 'desc' } }),
      this.prisma.entity.count(),
      this.prisma.ownership.count(),
      this.prisma.filing.count(),
    ]);

    return {
      hasData: entities > 0,
      uploadedAt: upload ? upload.createdAt.toISOString().slice(0, 10) : null,
      counts: { entities, ownership, filings },
    };
  }

  async entities(filters: Filters, today = new Date()) {
    const registry = await this.load();
    const { topLevel, shown } = buildHierarchy(
      registry.entities,
      registry.ownership,
      registry.filings,
      today,
      filters,
    );

    return {
      topLevel,
      totals: {
        topLevel: countRoots(registry),
        entities: registry.entities.filter((e) => e.registrationType === 'Entity').length,
        foreignQualifications: registry.entities.filter((e) => e.registrationType === 'FQ').length,
        shown,
      },
      // Only values actually present, so a filter can never be set to something that
      // returns nothing. Computed from the whole registry rather than the filtered
      // result, or choosing one filter would empty the options of the others.
      filterOptions: {
        jurisdictions: unique(registry.entities.map((e) => e.jurisdiction)),
        entityStatuses: unique(registry.entities.map((e) => e.entityStatus)),
        complianceStatuses: unique(collectCompliance(registry, today)),
      },
    };
  }

  async analytics(filters: AnalyticsFilters, today = new Date()): Promise<Analytics> {
    const registry = await this.load();
    return buildAnalytics(registry.entities, registry.ownership, registry.filings, today, filters);
  }

  /**
   * The whole registry, in three queries.
   *
   * It is small by nature — a corporate group, not a ledger of transactions — and the
   * hierarchy and every chart need all of it at once, so paging it in would cost more
   * round trips than it saved. If a registry ever outgrew that, the shape to change is
   * this method and nothing else.
   */
  private async load(): Promise<Registry> {
    const [entities, ownership, filings] = await Promise.all([
      this.prisma.entity.findMany(),
      this.prisma.ownership.findMany(),
      this.prisma.filing.findMany({ select: { entityName: true, dueDate: true, status: true } }),
    ]);
    return { entities, ownership, filings };
  }
}

const unique = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const countRoots = (registry: Registry): number => {
  const owned = new Set(registry.ownership.map((o) => o.childName));
  return registry.entities.filter((e) => e.registrationType === 'Entity' && !owned.has(e.name)).length;
};

function collectCompliance(registry: Registry, today: Date): string[] {
  const { topLevel } = buildHierarchy(registry.entities, registry.ownership, registry.filings, today);
  const statuses: string[] = [];
  const walk = (node: EntityNode): void => {
    statuses.push(node.complianceStatus);
    node.subsidiaries.forEach(walk);
    node.foreignQualifications.forEach(walk);
  };
  topLevel.forEach(walk);
  return statuses;
}
