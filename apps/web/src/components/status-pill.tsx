/** Entity Status, not compliance. Colour is spent on the seal, so this stays quiet. */

/** Statuses that end an entity's life. They read back rather than forward. */
const TERMINAL = new Set([
  'Dissolved',
  'Divested/Sold',
  'Merged/Acquired',
  'Revoked/Terminated',
  'Dormant',
]);

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const terminal = TERMINAL.has(status);

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border border-rule bg-surface px-2 py-0.5 text-label ${
        terminal ? 'text-ink-faint' : 'text-ink-soft'
      } ${className ?? ''}`}
    >
      {status}
    </span>
  );
}
