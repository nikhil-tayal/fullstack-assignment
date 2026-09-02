import { IngestionError } from '../ingestion-error';
import { ValidOwnership } from './records';

const graphError = (line: number, column: string, message: string): IngestionError => ({
  file: 'ownership.csv',
  line,
  column,
  class: 'graph',
  message,
});

/**
 * The graph pass: faults that no single row can show, because they only exist in the
 * shape the rows make together.
 *
 * Ownership is a directed acyclic graph rather than a tree — a company can be owned by
 * two parents, and appears under both — so the rules here are the ones that keep it a
 * DAG, plus the arithmetic rule that no child may be more than fully owned.
 *
 * Edges are expected to have already passed row and reference validation.
 */
export function validateGraph(ownership: ValidOwnership[]): IngestionError[] {
  const errors: IngestionError[] = [];

  const selfOwned = new Set<ValidOwnership>();
  for (const edge of ownership) {
    if (edge.parentName === edge.childName) {
      selfOwned.add(edge);
      errors.push(
        graphError(
          edge.line,
          'Child Entity',
          `"${edge.parentName}" cannot own itself. Remove this row, or correct one of the two names`,
        ),
      );
    }
  }

  const edges = ownership.filter((e) => !selfOwned.has(e));
  errors.push(...findCycles(edges));
  errors.push(...findOverAllocations(edges));

  return errors;
}

/**
 * Depth-first search over the ownership edges, reporting each distinct cycle once.
 *
 * A cycle is reported against the edge that closes it, since that is the row the user
 * can delete to break it, and the message spells out the whole loop so they can see
 * which link is the wrong one rather than guessing.
 */
function findCycles(edges: ValidOwnership[]): IngestionError[] {
  const children = new Map<string, ValidOwnership[]>();
  for (const edge of edges) {
    const list = children.get(edge.parentName);
    if (list) list.push(edge);
    else children.set(edge.parentName, [edge]);
  }

  const errors: IngestionError[] = [];
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const reported = new Set<string>();

  const walk = (node: string): void => {
    visited.add(node);
    onStack.add(node);
    stack.push(node);

    for (const edge of children.get(node) ?? []) {
      if (onStack.has(edge.childName)) {
        const loop = [...stack.slice(stack.indexOf(edge.childName)), edge.childName];
        const key = canonicalCycle(loop);
        if (!reported.has(key)) {
          reported.add(key);
          errors.push(
            graphError(
              edge.line,
              'Child Entity',
              `This row closes an ownership cycle: ${loop.join(' owns ')}. Ownership cannot loop back on itself — remove one of the rows in that chain`,
            ),
          );
        }
      } else if (!visited.has(edge.childName)) {
        walk(edge.childName);
      }
    }

    onStack.delete(node);
    stack.pop();
  };

  // Every node is a potential root: the graph may be a forest, and a cycle can sit in
  // a component that no top-level entity reaches.
  for (const node of children.keys()) {
    if (!visited.has(node)) walk(node);
  }

  return errors;
}

/** Rotation-independent key, so one cycle found from two entry points is reported once. */
function canonicalCycle(loop: string[]): string {
  const nodes = loop.slice(0, -1);
  const lowest = nodes.indexOf([...nodes].sort()[0]);
  return [...nodes.slice(lowest), ...nodes.slice(0, lowest)].join('>');
}

/**
 * A child owned more than 100% in total. Under 100% is legal and left alone — the
 * remainder is simply held outside the registry, and the analytics page shows it.
 *
 * Reported once per child rather than once per row, because the fault is the total,
 * and it is anchored on the last contributing row with every contribution named.
 */
function findOverAllocations(edges: ValidOwnership[]): IngestionError[] {
  const byChild = new Map<string, ValidOwnership[]>();
  for (const edge of edges) {
    const list = byChild.get(edge.childName);
    if (list) list.push(edge);
    else byChild.set(edge.childName, [edge]);
  }

  const errors: IngestionError[] = [];
  for (const [child, group] of byChild) {
    // Percentages carry two decimals, so the sum is done in hundredths to keep binary
    // floating point from turning 33.33 + 33.33 + 33.34 into something over 100.
    const hundredths = group.reduce((sum, e) => sum + Math.round(e.percent * 100), 0);
    if (hundredths <= 10_000) continue;

    const anchor = group.reduce((a, b) => (a.line >= b.line ? a : b));
    const breakdown = group.map((e) => `${e.percent}% on line ${e.line} (${e.parentName})`).join(', ');
    errors.push(
      graphError(
        anchor.line,
        'Ownership %',
        `"${child}" is owned ${hundredths / 100}% in total: ${breakdown}. Reduce the percentages so they add up to 100% or less`,
      ),
    );
  }

  return errors;
}
