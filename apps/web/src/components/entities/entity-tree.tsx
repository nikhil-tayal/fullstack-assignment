'use client';

import { useMemo, useState } from 'react';
import { StandingSeal } from '@/components/standing-seal';
import { StatusPill } from '@/components/status-pill';
import type { EntityNode } from '@/lib/types';

/** One indent level, matching `spacing.indent`. */
const INDENT = 24;

/** The one orchestrated moment: rows draw their seal in reading order. */
const STAGGER_MS = 30;

/** Past this the stagger stops being a sweep and becomes a wait. */
const MAX_STAGGERED_ROWS = 24;

/**
 * The registry hierarchy.
 *
 * Ownership is a graph, so the same company can be returned under two different
 * parents. Expansion is therefore keyed by the path taken to reach a node rather
 * than by its name: opening a company under one parent must not silently open it
 * somewhere else on the page, because those are two different facts about it.
 */
export function EntityTree({
  nodes,
  filtered,
}: {
  nodes: EntityNode[];
  /** With filters on, everything on screen is already a match or its context, so it opens. */
  filtered: boolean;
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // A new result set is a new set of paths; carrying the old overrides across
  // would leave rows open or shut for reasons the reader cannot see.
  const signature = useMemo(() => `${filtered}:${nodes.map((n) => n.name).join('|')}`, [nodes, filtered]);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setOverrides({});
  }

  const rows = flatten(nodes, filtered, overrides);

  return (
    <div role="tree" aria-label="Entity hierarchy" className="border-t border-rule">
      {rows.map((row, index) => (
        <EntityRow
          key={row.path}
          row={row}
          delayMs={index < MAX_STAGGERED_ROWS ? index * STAGGER_MS : 0}
          onToggle={() =>
            setOverrides((current) => ({ ...current, [row.path]: !row.open }))
          }
        />
      ))}
    </div>
  );
}

interface Row {
  node: EntityNode;
  path: string;
  depth: number;
  open: boolean;
  hasChildren: boolean;
  /** True when this node is reached as a foreign qualification of its parent. */
  isFq: boolean;
}

/**
 * Walks the tree into the flat list of rows actually on screen.
 *
 * Flattened rather than nested so the stagger can run in true reading order and
 * every visible row is one element in one list — which is also what a tree
 * widget's keyboard model expects.
 */
function flatten(
  nodes: EntityNode[],
  filtered: boolean,
  overrides: Record<string, boolean>,
  parentPath = '',
  depth = 0,
): Row[] {
  const rows: Row[] = [];

  for (const node of nodes) {
    const path = `${parentPath}/${node.name}`;
    const children = [...node.foreignQualifications, ...node.subsidiaries];
    const hasChildren = children.length > 0;
    // Filtered results are pruned to matches and their ancestors, so anything
    // still on screen earns its place and starts open. Unfiltered, only the
    // top level is open: the group is the thing to survey first.
    const open = overrides[path] ?? (filtered || depth === 0);

    rows.push({ node, path, depth, open, hasChildren, isFq: node.registrationType === 'FQ' });

    if (open && hasChildren) {
      rows.push(
        ...flatten(node.foreignQualifications, filtered, overrides, path, depth + 1),
        ...flatten(node.subsidiaries, filtered, overrides, path, depth + 1),
      );
    }
  }

  return rows;
}

function EntityRow({
  row,
  delayMs,
  onToggle,
}: {
  row: Row;
  delayMs: number;
  onToggle: () => void;
}) {
  const { node, depth, open, hasChildren, isFq } = row;

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? open : undefined}
      className={`border-b border-rule ${node.matched ? '' : 'opacity-60'}`}
    >
      <div className="flex items-stretch gap-3 py-3 pr-2">
        <Rails depth={depth} isFq={isFq} />

        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-faint hover:bg-paper hover:text-ink"
          >
            <Caret open={open} />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}

        {/* The stamp overhangs the ring on purpose, so the seal is given more
            clearance than the row's own gap would leave it. */}
        <StandingSeal
          status={node.complianceStatus}
          daysToDue={node.daysToDue}
          delayMs={delayMs}
          className="mr-1 self-center"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="truncate text-body text-ink">{node.name}</span>
            <Attribution node={node} isFq={isFq} />
          </div>
          <p className="mt-0.5 text-meta text-ink-soft">
            {node.jurisdiction}
            <span className="text-ink-faint"> · </span>
            {node.entityType}
            {node.businessId && (
              <>
                <span className="text-ink-faint"> · </span>
                <span className="font-mono">{node.businessId}</span>
              </>
            )}
          </p>
        </div>

        <StatusPill status={node.entityStatus} className="hidden sm:inline-flex" />

        <div className="hidden w-32 shrink-0 text-right md:block">
          <p className="label">Next filing</p>
          <p className="font-mono text-meta text-ink">{node.nextFilingDueDate ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The left margin of a nested row: one rail per level of ancestry, then the
 * elbow into this row.
 *
 * Indentation alone stops being readable about two levels down, when the eye has
 * nothing to run back up. The rails are the faintest thing on the page and carry
 * no information beyond depth, which is the only job they have.
 *
 * The elbow is where the two kinds of child are told apart. A subsidiary is a
 * different company that this parent owns a share of: a solid line, and a
 * percentage. A foreign qualification is the *same* company registered in another
 * jurisdiction: a dashed line, and no percentage, because there is no share to
 * hold in yourself.
 */
function Rails({ depth, isFq }: { depth: number; isFq: boolean }) {
  if (depth === 0) return null;

  return (
    <span aria-hidden="true" className="flex shrink-0 self-stretch">
      {Array.from({ length: depth - 1 }, (_, level) => (
        <span key={level} className="border-l border-rule" style={{ width: INDENT }} />
      ))}
      <span className="relative border-l border-rule" style={{ width: INDENT }}>
        <span
          className={`absolute left-0 top-1/2 w-full ${
            isFq ? 'border-t border-dashed border-ink-faint' : 'border-t border-rule'
          }`}
        />
      </span>
    </span>
  );
}

function Attribution({ node, isFq }: { node: EntityNode; isFq: boolean }) {
  if (isFq) {
    return (
      <span className="label text-ink-faint">Foreign qualification</span>
    );
  }
  if (node.ownershipPercent === null) return null;

  return (
    <span className="font-mono text-meta text-ink-soft">
      {formatPercent(node.ownershipPercent)}
    </span>
  );
}

/** Trailing zeros are noise on a whole number and precision on a fractional one. */
function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
    >
      <path d="M2 0.5 L8 5 L2 9.5 Z" fill="currentColor" />
    </svg>
  );
}
