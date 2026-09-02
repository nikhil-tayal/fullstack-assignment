'use client';

import { useId, useState } from 'react';

const ACCEPTED = ['.csv', '.xlsx'];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasAcceptedExtension(name: string): boolean {
  return ACCEPTED.some((ext) => name.toLowerCase().endsWith(ext));
}

export function FileDrop({
  label,
  hint,
  file,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    if (!hasAcceptedExtension(candidate.name)) {
      setRejected(`${candidate.name} is not a .csv or .xlsx file. Choose a different file.`);
      return;
    }
    setRejected(null);
    onChange(candidate);
  }

  return (
    <div>
      {/* A real <label> over a visually hidden input, so the whole zone is one
          click target and one tab stop without any click-handler mimicry. */}
      <label htmlFor={inputId} className={disabled ? 'cursor-default' : 'cursor-pointer'}>
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED.join(',')}
          disabled={disabled}
          className="peer sr-only"
          onChange={(event) => accept(event.target.files?.[0])}
        />
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) accept(event.dataTransfer.files?.[0]);
          }}
          className={`flex h-full flex-col gap-1 rounded border px-4 py-4 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-seal ${
            dragging
              ? 'border-seal bg-paper'
              : file
                ? 'border-seal/40 bg-surface'
                : 'border-dashed border-rule bg-surface hover:border-ink-faint'
          }`}
        >
          <span className="label">{label}</span>

          {file ? (
            <>
              <span className="break-all font-mono text-meta text-ink">{file.name}</span>
              <span className="text-meta text-ink-faint">
                {formatSize(file.size)} · Click to choose a different file
              </span>
            </>
          ) : (
            <>
              <span className="text-meta text-ink">Drop the file here, or click to choose</span>
              <span className="text-meta text-ink-faint">{hint}</span>
            </>
          )}
        </div>
      </label>

      {rejected && (
        <p role="alert" className="mt-2 text-meta text-stamp">
          {rejected}
        </p>
      )}
    </div>
  );
}
