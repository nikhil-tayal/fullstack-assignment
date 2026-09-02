import type { ComplianceStatus } from '@/lib/types';

/**
 * Compliance is the only place colour carries meaning in this product, so it is
 * the only scale with real colour. It matches the seal exactly: a reader who
 * learned the ring on the list page already knows this chart.
 */
export const COMPLIANCE_COLOUR: Record<ComplianceStatus, string> = {
  GOOD_STANDING: 'var(--seal)',
  FILING_DUE: 'var(--amber)',
  OVERDUE: 'var(--stamp)',
  SUSPENDED: 'var(--void)',
  NOT_APPLICABLE: 'var(--ink-faint)',
  TBD: 'var(--slate)',
};

/**
 * Everything that is not compliance gets ink at decreasing weight.
 *
 * Entity Status has no good or bad direction — Active is not better than Merged,
 * it is a different fact — so giving it colour would invent a judgement the data
 * does not make, and would compete with the one scale that means something.
 */
const NEUTRAL_RAMP = [
  '#141b2e',
  '#5a6b80',
  '#2b3550',
  '#98a2b3',
  '#445070',
  '#c2c8d2',
  '#78849a',
  '#e0e4e8',
];

/**
 * Deliberately not ordered dark to light: neighbouring steps on a stacked bar
 * have to be told apart at four pixels wide, so the ramp alternates weight and
 * every step is far from the one beside it. Eight covers the Entity Status
 * vocabulary with room to spare — two statuses sharing a swatch would be a lie.
 */
export const neutral = (index: number): string => NEUTRAL_RAMP[index % NEUTRAL_RAMP.length];

/** A row of bars sharing one scale, so lengths are comparable down the column. */
export function BarRows({
  rows,
}: {
  rows: { key: string; label: string; value: number; colour: string; note?: string }[];
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3">
          <span className="truncate text-meta text-ink-soft" title={row.label}>
            {row.label}
          </span>
          <span className="h-4 bg-paper">
            <span
              className="block h-full"
              style={{ width: `${(row.value / max) * 100}%`, background: row.colour }}
            />
          </span>
          <span className="text-right font-mono text-meta text-ink">{row.note ?? row.value}</span>
        </div>
      ))}
    </div>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  colour: string;
  /** Rendered as hatching rather than fill: for a share nobody in the registry holds. */
  hollow?: boolean;
}

/**
 * One bar divided into parts of a whole.
 *
 * `total` is passed rather than summed because two of the three charts using this
 * have a fixed denominator — 100% of a child, or the largest group on the chart —
 * and a bar that silently rescaled itself to its own contents would make unequal
 * rows look equal.
 */
export function StackedBar({
  segments,
  total,
  label,
  value,
}: {
  segments: Segment[];
  total: number;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-meta text-ink" title={label}>
          {label}
        </span>
        <span className="shrink-0 font-mono text-meta text-ink-soft">{value}</span>
      </div>
      <div className="mt-1 flex h-4 w-full overflow-hidden bg-paper">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.key}
              title={`${segment.label}: ${segment.value}`}
              className="h-full"
              style={{
                width: `${(segment.value / total) * 100}%`,
                background: segment.hollow
                  ? `repeating-linear-gradient(-45deg, ${segment.colour} 0 1px, transparent 1px 5px)`
                  : segment.colour,
              }}
            />
          ))}
      </div>
    </div>
  );
}

/** Named swatches, so a stacked bar is readable without hovering it. */
export function Legend({ items }: { items: { key: string; label: string; colour: string; hollow?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0"
            style={{
              background: item.hollow
                ? `repeating-linear-gradient(-45deg, ${item.colour} 0 1px, transparent 1px 4px)`
                : item.colour,
              border: item.hollow ? '1px solid var(--rule)' : undefined,
            }}
          />
          <span className="text-meta text-ink-soft">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
