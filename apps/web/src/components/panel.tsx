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
}: {
  title?: ReactNode;
  /** A control that belongs to the panel, e.g. a chart's parent selector. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded border border-rule bg-surface shadow-press ${className ?? ''}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
          {title && <h2 className="label">{title}</h2>}
          {action}
        </header>
      )}
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
