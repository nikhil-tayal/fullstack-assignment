'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BarRows, COMPLIANCE_COLOUR, Legend, StackedBar, neutral } from '@/components/analytics/charts';
import { SortableGrid } from '@/components/analytics/sortable-grid';
import { EmptyState } from '@/components/empty-state';
import { FilterBar } from '@/components/filter-bar';
import { withQuery } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import {
  COMPLIANCE_STATUS_LABELS,
  type AnalyticsResponse,
  type ComplianceStatus,
  type OwnershipSplit,
  type RegionStatusCounts,
} from '@/lib/types';

const EMPTY = { jurisdiction: '', entityStatus: '' };

export default function AnalyticsPage() {
  const [filters, setFilters] = useState(EMPTY);
  const [parent, setParent] = useState('');

  const { data, error, reload, loading } = useApi<AnalyticsResponse>(
    withQuery('/analytics', { ...filters, parent }),
  );

  if (error) {
    return (
      <Shell>
        <EmptyState
          title="The registry could not be read"
          body={error}
          action={
            <button
              type="button"
              onClick={reload}
              className="text-meta text-seal underline decoration-rule underline-offset-4 hover:decoration-seal"
            >
              Try again
            </button>
          }
        />
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <p className="py-10 text-center text-meta text-ink-soft">Reading the registry…</p>
      </Shell>
    );
  }

  const empty =
    data.complianceBreakdown.length === 0 &&
    data.entityStatusByRegion.length === 0 &&
    data.compositionByTopLevel.length === 0;

  if (empty && !filters.jurisdiction && !filters.entityStatus) {
    return (
      <Shell>
        <EmptyState
          title="No registry yet"
          body="Upload entities, ownership and filings to see the group measured here."
          action={
            <Link
              href="/"
              className="text-meta text-seal underline decoration-rule underline-offset-4 hover:decoration-seal"
            >
              Upload the registry
            </Link>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <FilterBar
        selects={[
          {
            name: 'jurisdiction',
            label: 'Jurisdiction',
            value: filters.jurisdiction,
            options: data.filterOptions.jurisdictions.map((v) => ({ value: v, label: v })),
          },
          {
            name: 'entityStatus',
            label: 'Entity status',
            value: filters.entityStatus,
            options: data.filterOptions.entityStatuses.map((v) => ({ value: v, label: v })),
          },
        ]}
        onSelect={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
        onClear={() => setFilters(EMPTY)}
      >
        These two narrow every chart except the ownership split, which always shows a
        parent&rsquo;s whole holding.
      </FilterBar>

      <div className="mt-6">
        <SortableGrid
          storageKey="analytics-chart-order"
          // items-start so a short chart is a short panel: stretching one to match its
          // neighbour just adds empty frame under it.
          className={`grid items-start gap-6 lg:grid-cols-2 ${loading ? 'opacity-50' : ''}`}
          items={[
            {
              // These ids are persisted in the reader's browser: never rename them.
              id: 'compliance',
              title: 'Compliance standing',
              content: <Compliance rows={data.complianceBreakdown} />,
            },
            {
              id: 'region',
              title: 'Entity status by region',
              content: <ByRegion regions={data.entityStatusByRegion} />,
            },
            {
              id: 'composition',
              title: 'What hangs off each top-level entity',
              content: <Composition rows={data.compositionByTopLevel} />,
            },
            {
              id: 'ownership',
              title: 'Ownership split',
              action: data.parentOptions.length > 0 && (
                <select
                  aria-label="Parent entity"
                  value={parent}
                  onChange={(event) => setParent(event.target.value)}
                  className="max-w-[14rem] border-b border-rule bg-transparent pb-0.5 text-meta text-ink focus:border-seal focus:outline-none"
                >
                  <option value="">Choose a parent</option>
                  {data.parentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ),
              content: (
                <Split split={data.ownershipSplit} hasParents={data.parentOptions.length > 0} />
              ),
            },
          ]}
        />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell py-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-title tracking-tight">Analytics</h1>
        <p className="mt-2 text-ink-soft">
          Where the group stands, where it is registered, and how much of each company it
          actually holds.
        </p>
      </header>
      <div className="mt-8">{children}</div>
    </main>
  );
}

function Compliance({ rows }: { rows: { status: ComplianceStatus; count: number }[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing to measure" body="No entity matches these filters." />;
  }

  return (
    <BarRows
      rows={rows.map((row) => ({
        key: row.status,
        label: COMPLIANCE_STATUS_LABELS[row.status] ?? row.status,
        value: row.count,
        colour: COMPLIANCE_COLOUR[row.status] ?? 'var(--slate)',
      }))}
    />
  );
}

function ByRegion({ regions }: { regions: RegionStatusCounts[] }) {
  if (regions.length === 0) {
    return <EmptyState title="Nothing to measure" body="No entity matches these filters." />;
  }

  // One scale across every region, so a tall bar means a large region rather than
  // a region that happens to be alone on its row.
  const statuses = [...new Set(regions.flatMap((region) => Object.keys(region.counts)))].sort();
  const totals = regions.map((region) => Object.values(region.counts).reduce((a, b) => a + b, 0));
  const max = Math.max(...totals, 1);

  return (
    <div className="space-y-4">
      <Legend
        items={statuses.map((status, index) => ({ key: status, label: status, colour: neutral(index) }))}
      />
      <div className="space-y-3">
        {regions.map((region, regionIndex) => (
          <StackedBar
            key={region.region}
            label={region.region}
            value={String(totals[regionIndex])}
            total={max}
            segments={statuses.map((status, index) => ({
              key: status,
              label: status,
              value: region.counts[status] ?? 0,
              colour: neutral(index),
            }))}
          />
        ))}
      </div>
    </div>
  );
}

function Composition({
  rows,
}: {
  rows: { name: string; subsidiaries: number; foreignQualifications: number }[];
}) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing to measure" body="No entity matches these filters." />;
  }

  const max = Math.max(...rows.map((row) => row.subsidiaries + row.foreignQualifications), 1);

  return (
    <div className="space-y-4">
      <Legend
        items={[
          { key: 'sub', label: 'Subsidiaries', colour: 'var(--ink)' },
          { key: 'fq', label: 'Foreign qualifications', colour: 'var(--slate)' },
        ]}
      />
      <div className="space-y-3">
        {rows.map((row) => (
          <StackedBar
            key={row.name}
            label={row.name}
            value={String(row.subsidiaries + row.foreignQualifications)}
            total={max}
            segments={[
              { key: 'sub', label: 'Subsidiaries', value: row.subsidiaries, colour: 'var(--ink)' },
              {
                key: 'fq',
                label: 'Foreign qualifications',
                value: row.foreignQualifications,
                colour: 'var(--slate)',
              },
            ]}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One bar per child, each running the full width of that child's equity.
 *
 * Not a pie across the children: the percentages are capped per child and share
 * no denominator, so a parent holding 60% of one company and 100% of another has
 * not allocated 160% of anything.
 */
function Split({ split, hasParents }: { split: OwnershipSplit | null; hasParents: boolean }) {
  if (!hasParents) {
    return (
      <EmptyState
        title="No ownership on record"
        body="This registry has no parent-child relationships to divide."
      />
    );
  }
  if (!split) {
    return (
      <EmptyState
        title="Choose a parent"
        body="Pick a parent entity to see how much of each company it holds, and who holds the rest."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Legend
        items={[
          { key: 'mine', label: split.parent, colour: 'var(--seal)' },
          { key: 'others', label: 'Other owners in this registry', colour: 'var(--slate)' },
          { key: 'outside', label: 'Outside the registry', colour: 'var(--ink-faint)', hollow: true },
        ]}
      />
      <div className="space-y-3">
        {split.children.map((child) => (
          <StackedBar
            key={child.name}
            label={child.name}
            value={`${child.percent}%`}
            total={100}
            segments={[
              { key: 'mine', label: split.parent, value: child.percent, colour: 'var(--seal)' },
              {
                key: 'others',
                label: 'Other owners in this registry',
                value: child.heldByOthers,
                colour: 'var(--slate)',
              },
              {
                key: 'outside',
                label: 'Outside the registry',
                value: child.unallocated,
                colour: 'var(--ink-faint)',
                hollow: true,
              },
            ]}
          />
        ))}
      </div>
    </div>
  );
}
