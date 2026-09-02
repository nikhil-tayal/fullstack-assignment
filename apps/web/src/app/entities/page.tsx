'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { EntityTree } from '@/components/entities/entity-tree';
import { FilterBar } from '@/components/filter-bar';
import { useApi } from '@/lib/use-api';
import { useDebounced } from '@/lib/use-debounced';
import { withQuery } from '@/lib/api';
import { COMPLIANCE_STATUS_LABELS, type ComplianceStatus, type EntitiesResponse } from '@/lib/types';

const EMPTY = { entityStatus: '', complianceStatus: '', jurisdiction: '' };

export default function EntitiesPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY);
  const settledSearch = useDebounced(search);

  const path = withQuery('/registry/entities', { search: settledSearch, ...filters });
  const { data, error, loading, reload } = useApi<EntitiesResponse>(path);

  const active = Boolean(settledSearch) || Object.values(filters).some(Boolean);

  return (
    <main className="shell py-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-title tracking-tight">The registry</h1>
        <p className="mt-2 text-ink-soft">
          Every entity, the companies it owns, and the jurisdictions it is separately
          registered in. The seal on each row is its compliance standing; the ring runs
          down as the next filing date approaches.
        </p>
      </header>

      <div className="mt-8">
        <FilterBar
          search={{ value: search, placeholder: 'Entity name' }}
          onSearch={setSearch}
          selects={[
            {
              name: 'jurisdiction',
              label: 'Jurisdiction',
              value: filters.jurisdiction,
              options: options(data?.filterOptions.jurisdictions),
            },
            {
              name: 'entityStatus',
              label: 'Entity status',
              value: filters.entityStatus,
              options: options(data?.filterOptions.entityStatuses),
            },
            {
              name: 'complianceStatus',
              label: 'Compliance',
              value: filters.complianceStatus,
              options: (data?.filterOptions.complianceStatuses ?? []).map((status) => ({
                value: status,
                label: COMPLIANCE_STATUS_LABELS[status as ComplianceStatus] ?? status,
              })),
            },
          ]}
          onSelect={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
          onClear={() => {
            setSearch('');
            setFilters(EMPTY);
          }}
        >
          {data && <Summary data={data} active={active} />}
        </FilterBar>
      </div>

      <div className={`mt-6 transition-opacity ${loading && data ? 'opacity-50' : ''}`}>
        {error ? (
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
        ) : !data ? (
          <p className="py-10 text-center text-meta text-ink-soft">Reading the registry…</p>
        ) : data.totals.entities === 0 ? (
          <EmptyState
            title="No registry yet"
            body="Upload entities, ownership and filings to see the group here."
            action={
              <Link
                href="/"
                className="text-meta text-seal underline decoration-rule underline-offset-4 hover:decoration-seal"
              >
                Upload the registry
              </Link>
            }
          />
        ) : data.topLevel.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            body="No entity in the registry meets all of them at once. Widen one, or clear them and start again."
          />
        ) : (
          <EntityTree nodes={data.topLevel} filtered={active} />
        )}
      </div>
    </main>
  );
}

function Summary({ data, active }: { data: EntitiesResponse; active: boolean }) {
  const { topLevel, entities, foreignQualifications, shown } = data.totals;
  if (entities === 0) return null;

  return active ? (
    shown === 0 ? (
      // The "with the parents they sit under" clause describes rows that are not
      // there when nothing matched; the empty state below carries the message instead.
      <>No matches.</>
    ) : (
      <>
        <span className="font-mono text-ink">{shown}</span> matching, shown with the parents they
        sit under.
      </>
    )
  ) : (
    <>
      <span className="font-mono text-ink">{entities}</span> entities under{' '}
      <span className="font-mono text-ink">{topLevel}</span> top-level, and{' '}
      <span className="font-mono text-ink">{foreignQualifications}</span> foreign qualifications.
    </>
  );
}

const options = (values: string[] | undefined) =>
  (values ?? []).map((value) => ({ value, label: value }));
