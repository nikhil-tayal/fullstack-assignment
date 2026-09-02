import type { ReactNode } from 'react';

/**
 * Frameless on purpose: a chart panel keeps its own frame and title and puts
 * this inside, so an empty panel still reads as the panel it will become.
 *
 * The copy rule these all follow: say what happened and what to do, in the same
 * words the controls use. Never apologise, never blame the reader.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <p className="text-lead text-ink">{title}</p>
      <p className="max-w-sm text-meta text-ink-soft">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
