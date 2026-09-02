'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';

type Health = {
  status: string;
  service: string;
  uptime: number;
  timestamp: string;
};

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: Health }
  | { kind: 'error'; message: string };

// Proves the nginx /api route actually reaches Nest — the one thing worth
// verifying on a fresh deploy before there's any real feature to look at.
export function HealthCheck() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetch(apiUrl('/health'))
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json() as Promise<Health>;
      })
      .then((data) => {
        if (!cancelled) setState({ kind: 'ok', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Request failed',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">API health</span>
        <StatusDot state={state} />
      </div>
      <pre className="mt-3 overflow-x-auto font-mono text-xs text-[var(--muted)]">
        {state.kind === 'loading' && 'checking /api/health…'}
        {state.kind === 'ok' && JSON.stringify(state.data, null, 2)}
        {state.kind === 'error' && state.message}
      </pre>
    </div>
  );
}

function StatusDot({ state }: { state: State }) {
  const color =
    state.kind === 'ok'
      ? 'bg-emerald-500'
      : state.kind === 'error'
        ? 'bg-red-500'
        : 'bg-zinc-400';

  return (
    <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
      <span className={`size-2 rounded-full ${color}`} />
      {state.kind}
    </span>
  );
}
