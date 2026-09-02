'use client';

import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Panel } from '@/components/panel';

export interface SortableItem {
  /** Stable across renders and reorders — this is what the saved order stores. */
  id: string;
  title: string;
  /** A control belonging to the panel, e.g. the ownership chart's parent selector. */
  action?: ReactNode;
  content: ReactNode;
}

/**
 * The analytics grid, reorderable by the reader.
 *
 * Which chart matters most depends on the question being asked, and that is not
 * something the page can know — so the order is the reader's to set, and it is
 * remembered per browser.
 *
 * Dragging is native HTML5 drag-and-drop rather than a library: four cards do not
 * justify a dependency. Native DnD is mouse-only, though, so the same move is on
 * the keyboard — the grip is a real button and the arrow keys move the panel.
 * Without that the feature would be unreachable for anyone not using a mouse.
 */
export function SortableGrid({
  items,
  storageKey,
  className,
}: {
  items: SortableItem[];
  storageKey: string;
  className?: string;
}) {
  const ids = items.map((item) => item.id);
  const [order, setOrder] = useState<string[]>(ids);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const liveId = useId();

  // Read after mount, never during render: the server has no localStorage, and
  // a first paint that disagreed with the HTML would be a hydration mismatch.
  useEffect(() => {
    let saved: string[] | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw) as string[];
    } catch {
      // A browser with storage blocked still gets the default order.
    }
    if (saved) setOrder(reconcile(saved, ids));
    // The chart set is fixed for the life of the page, so this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = (next: string[]) => {
    setOrder(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Reordering still works for this visit; it just will not be remembered.
    }
  };

  const move = (id: string, to: number) => {
    const from = order.indexOf(id);
    if (from === -1 || to < 0 || to >= order.length || to === from) return;
    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    persist(next);
    const title = items.find((item) => item.id === id)?.title ?? id;
    setAnnouncement(`${title} moved to position ${to + 1} of ${next.length}.`);
  };

  const ordered = order
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is SortableItem => item !== undefined);

  const rearranged = order.join('|') !== ids.join('|');

  return (
    <>
      <div className="flex items-baseline justify-between gap-4 pb-2">
        <p className="text-meta text-ink-faint">
          Drag a panel by its grip to reorder, or focus a grip and use the arrow keys.
        </p>
        {rearranged && (
          <button
            type="button"
            onClick={() => {
              persist(ids);
              setAnnouncement('Layout reset to the default order.');
            }}
            className="shrink-0 text-meta text-seal underline decoration-rule underline-offset-4 hover:decoration-seal"
          >
            Reset layout
          </button>
        )}
      </div>

      <div className={className}>
        {ordered.map((item, index) => (
          <div
            key={item.id}
            onDragOver={(event) => {
              if (dragging === null) return;
              // Without preventDefault the element is not a valid drop target.
              event.preventDefault();
              setOver(item.id);
            }}
            onDragLeave={() => setOver((current) => (current === item.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              if (dragging !== null) move(dragging, index);
              setDragging(null);
              setOver(null);
            }}
            className={
              over === item.id && dragging !== item.id
                ? 'rounded outline outline-2 outline-offset-2 outline-seal'
                : undefined
            }
          >
            <Panel
              title={item.title}
              action={item.action}
              className={dragging === item.id ? 'opacity-50' : undefined}
              handle={
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setDragging(item.id);
                    event.dataTransfer.effectAllowed = 'move';
                    // Firefox will not start a drag unless something is set.
                    event.dataTransfer.setData('text/plain', item.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onKeyDown={(event) => {
                    const delta =
                      event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? -1
                        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
                          ? 1
                          : 0;
                    if (delta === 0) return;
                    event.preventDefault();
                    move(item.id, index + delta);
                  }}
                  aria-label={`Reorder ${item.title}. Position ${index + 1} of ${ordered.length}. Use the arrow keys to move it.`}
                  aria-describedby={liveId}
                  className="-ml-1 cursor-grab rounded px-1 text-ink-faint hover:text-ink-soft active:cursor-grabbing"
                >
                  <Grip />
                </button>
              }
            >
              {item.content}
            </Panel>
          </div>
        ))}
      </div>

      {/* Keyboard moves are silent otherwise: the panel moves, off screen reading. */}
      <p id={liveId} aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}

/**
 * A saved order can be stale — charts may have been added or removed since it was
 * written. Keep what still exists, in the saved order, then append anything new.
 */
function reconcile(saved: string[], current: string[]): string[] {
  const kept = saved.filter((id) => current.includes(id));
  return [...kept, ...current.filter((id) => !kept.includes(id))];
}

function Grip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" fill="currentColor">
      {[0, 1, 2].map((row) =>
        [0, 1].map((col) => (
          <circle key={`${row}-${col}`} cx={1.5 + col * 7} cy={3 + row * 5} r="1.25" />
        )),
      )}
    </svg>
  );
}
