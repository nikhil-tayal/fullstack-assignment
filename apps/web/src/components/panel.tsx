import type { ReactNode } from 'react';

/**
 * The framed container. Cards are for the upload page and chart panels only —
 * the entity list is ruled, not carded — so this deliberately has no variants.
 */
export function Panel({
  title,
  action,
  children,
  className,
  handle,
}: {
  title?: ReactNode;
  /** A control that belongs to the panel, e.g. a chart's parent selector. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** A grip for moving the whole panel, e.g. in the reorderable analytics grid. */
  handle?: ReactNode;
}) {
  return (
    <section className={`rounded border border-rule bg-surface shadow-press ${className ?? ''}`}>
      {(title || action || handle) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
          {/* Grouped with the title so justify-between still splits header from action,
              rather than spreading three children across the row. */}
          {handle ? (
            <div className="flex items-center gap-2">
              {handle}
              {title && <h2 className="label">{title}</h2>}
            </div>
          ) : (
            title && <h2 className="label">{title}</h2>
          )}
          {action}
        </header>
      )}
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
