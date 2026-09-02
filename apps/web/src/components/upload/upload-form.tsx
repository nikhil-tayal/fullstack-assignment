'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/button';
import { Panel } from '@/components/panel';
import { FileDrop } from '@/components/upload/file-drop';
import { ValidationReport } from '@/components/upload/validation-report';
import { ApiError, apiFetch } from '@/lib/api';
import type { UploadAccepted, UploadField, UploadMissingFiles, UploadRejected } from '@/lib/types';

const ZONES: { field: UploadField; label: string; hint: string }[] = [
  { field: 'entities', label: 'Entities', hint: 'entities.csv or entities.xlsx' },
  { field: 'ownership', label: 'Ownership', hint: 'ownership.csv or ownership.xlsx' },
  { field: 'filings', label: 'Filings', hint: 'filings.csv or filings.xlsx' },
];

type Chosen = Record<UploadField, File | null>;

type Result =
  | { kind: 'accepted'; data: UploadAccepted }
  | { kind: 'missing'; data: UploadMissingFiles }
  | { kind: 'rejected'; data: UploadRejected }
  | { kind: 'failed'; message: string };

export function UploadForm() {
  const [chosen, setChosen] = useState<Chosen>({ entities: null, ownership: null, filings: null });
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const complete = ZONES.every((zone) => chosen[zone.field] !== null);

  function choose(field: UploadField, file: File | null) {
    setChosen((current) => ({ ...current, [field]: file }));
    // A report describes the files that were sent, so it stops being true the
    // moment one of them is swapped out.
    setResult(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || pending) return;

    const body = new FormData();
    for (const zone of ZONES) {
      const file = chosen[zone.field];
      if (file) body.append(zone.field, file);
    }

    setPending(true);
    setResult(null);
    try {
      const data = await apiFetch<UploadAccepted>('/uploads', { method: 'POST', body });
      setResult({ kind: 'accepted', data });
    } catch (error) {
      setResult(toResult(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} noValidate>
        <Panel title="The three files">
          <div className="grid gap-4 sm:grid-cols-3">
            {ZONES.map((zone) => (
              <FileDrop
                key={zone.field}
                label={zone.label}
                hint={zone.hint}
                file={chosen[zone.field]}
                disabled={pending}
                onChange={(file) => choose(zone.field, file)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-rule pt-5">
            <Button type="submit" disabled={!complete || pending}>
              {pending ? 'Checking the files…' : 'Upload registry'}
            </Button>
            <p className="text-meta text-ink-soft">
              {complete
                ? 'All three are checked together, so nothing is stored unless every file is clean.'
                : 'All three files go in one request; the cross-file rules cannot be checked otherwise.'}
            </p>
          </div>
        </Panel>
      </form>

      {result?.kind === 'accepted' && <Accepted data={result.data} />}
      {result?.kind === 'missing' && <Missing data={result.data} />}
      {result?.kind === 'rejected' && <ValidationReport report={result.data} />}
      {result?.kind === 'failed' && <Failed message={result.message} />}
    </div>
  );
}

function toResult(error: unknown): Result {
  if (error instanceof ApiError) {
    if (error.status === 400) return { kind: 'missing', data: error.bodyAs<UploadMissingFiles>() };
    if (error.status === 422) return { kind: 'rejected', data: error.bodyAs<UploadRejected>() };
    return { kind: 'failed', message: error.message };
  }
  return {
    kind: 'failed',
    message: 'The upload did not reach the registry. Check the connection and upload again.',
  };
}

function Accepted({ data }: { data: UploadAccepted }) {
  return (
    <section
      aria-live="polite"
      className="rounded border border-seal/40 bg-surface p-5 shadow-press"
    >
      {/* The API's own message already distinguishes the two outcomes, so the
          eyebrow marks which one happened rather than restating it. */}
      <p className="label text-seal">{data.changed ? 'Stored' : 'No change'}</p>
      <h2 className="mt-1 text-lead text-ink">{data.message}</h2>

      <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-2 border-t border-rule pt-4">
        {(['entities', 'ownership', 'filings'] as const).map((key) => (
          <div key={key}>
            <dt className="label">{key}</dt>
            <dd className="font-mono text-lead text-ink">{data.counts[key]}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5">
        <Link
          href="/entities"
          className="text-meta text-seal underline decoration-rule underline-offset-4 hover:decoration-seal"
        >
          Open the registry
        </Link>
      </p>
    </section>
  );
}

function Missing({ data }: { data: UploadMissingFiles }) {
  return (
    <section aria-live="polite" className="rounded border border-stamp/40 bg-surface p-5 shadow-press">
      <p className="label text-stamp">Not sent</p>
      <p className="mt-1 text-lead text-ink">{data.message}</p>
    </section>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <section aria-live="polite" className="rounded border border-stamp/40 bg-surface p-5 shadow-press">
      <p className="label text-stamp">Not sent</p>
      <p className="mt-1 text-lead text-ink">{message}</p>
    </section>
  );
}
