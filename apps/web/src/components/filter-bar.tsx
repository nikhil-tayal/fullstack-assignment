'use client';

import { useId } from 'react';

export interface SelectFilter {
  name: string;
  label: string;
  value: string;
  /** Empty means the filter is off; the option reads "Any <label>". */
  options: { value: string; label: string }[];
}

/**
 * The page-level filter row, shared by both pages so a filter looks and behaves
 * the same wherever it appears.
 *
 * Ruled rather than boxed, and sitting directly under the page title: these are
 * a property of the page, not a widget floating on it. Options are always drawn
 * from the whole registry, so choosing one filter can never empty another.
 */
export function FilterBar({
  search,
  selects,
  onSearch,
  onSelect,
  onClear,
  children,
}: {
  /** Omitted on the analytics page, which filters by facet only. */
  search?: { value: string; placeholder: string };
  selects: SelectFilter[];
  onSearch?: (value: string) => void;
  onSelect: (name: string, value: string) => void;
  onClear: () => void;
  /** A trailing summary line, e.g. how many rows matched. */
  children?: React.ReactNode;
}) {
  const searchId = useId();
  const active = Boolean(search?.value) || selects.some((s) => s.value);

  return (
    <div className="border-y border-rule py-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {search && onSearch && (
          <div className="min-w-[16rem] flex-1">
            <label htmlFor={searchId} className="label block">
              Search
            </label>
            <input
              id={searchId}
              type="search"
              value={search.value}
              placeholder={search.placeholder}
              onChange={(event) => onSearch(event.target.value)}
              className="mt-1 w-full border-b border-rule bg-transparent pb-1 text-body text-ink placeholder:text-ink-faint focus:border-seal focus:outline-none"
            />
          </div>
        )}

        {selects.map((filter) => (
          <Select key={filter.name} filter={filter} onSelect={onSelect} />
        ))}

        {/* Only offered once there is something to clear: a permanently visible
            reset invites the reader to wonder what state they are in. */}
        {active && (
          <button
            type="button"
            onClick={onClear}
            className="pb-1 text-meta text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink-faint"
          >
            Clear filters
          </button>
        )}
      </div>

      {children && <div className="mt-3 text-meta text-ink-soft">{children}</div>}
    </div>
  );
}

function Select({
  filter,
  onSelect,
}: {
  filter: SelectFilter;
  onSelect: (name: string, value: string) => void;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="label block">
        {filter.label}
      </label>
      <select
        id={id}
        value={filter.value}
        onChange={(event) => onSelect(filter.name, event.target.value)}
        className="mt-1 border-b border-rule bg-transparent pb-1 text-body text-ink focus:border-seal focus:outline-none"
      >
        <option value="">Any</option>
        {filter.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
