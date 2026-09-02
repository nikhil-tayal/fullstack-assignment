import {
  ERROR_CLASSES,
  ERROR_CLASS_DESCRIPTIONS,
  ERROR_CLASS_HEADINGS,
  type ErrorClass,
  type IngestionError,
  type SourceFile,
  type UploadRejected,
} from '@/lib/types';

/**
 * The reader of this is holding the spreadsheet open beside it, working top to
 * bottom. So the shape of the page is the shape of that job: the four classes in
 * the order the contract fixes, then a block per file, then rows in line order
 * under a ruled Line / Column / What to fix header. Messages are rendered
 * verbatim — they are written for this reader and already name the fix.
 */
export function ValidationReport({ report }: { report: UploadRejected }) {
  const present = ERROR_CLASSES.filter((klass) => byClass(report, klass).length > 0);

  return (
    <section
      aria-labelledby="validation-report-title"
      className="rounded border border-stamp/40 bg-surface shadow-press"
    >
      <header className="border-b border-rule px-5 py-4">
        <p className="label text-stamp">Not accepted</p>
        <h2 id="validation-report-title" className="mt-1 text-lead text-ink">
          {report.message}
        </h2>

        {/* Jump list rather than decoration: 21 problems is more than fits on a
            screen, and the reader wants to know the shape before scrolling. */}
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {present.map((klass) => (
            <li key={klass}>
              <a
                href={`#errors-${klass}`}
                className="text-meta text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink-faint"
              >
                {ERROR_CLASS_HEADINGS[klass]}{' '}
                <span className="font-mono text-ink">{report.summary.byClass[klass]}</span>
              </a>
            </li>
          ))}
        </ul>
      </header>

      <div className="divide-y divide-rule">
        {present.map((klass) => (
          <ClassGroup key={klass} klass={klass} errors={byClass(report, klass)} />
        ))}
      </div>
    </section>
  );
}

function byClass(report: UploadRejected, klass: ErrorClass): IngestionError[] {
  return report.errors.filter((error) => error.class === klass);
}

function ClassGroup({ klass, errors }: { klass: ErrorClass; errors: IngestionError[] }) {
  const files = groupByFile(errors);

  return (
    <section id={`errors-${klass}`} className="scroll-mt-4 px-5 py-5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-lead text-ink">{ERROR_CLASS_HEADINGS[klass]}</h3>
        <span className="font-mono text-meta text-stamp">{errors.length}</span>
      </div>
      <p className="mt-0.5 text-meta text-ink-soft">{ERROR_CLASS_DESCRIPTIONS[klass]}</p>

      {/* One column header for the whole group, then a band per file: the
          columns stay aligned all the way down, which is what makes a list this
          long worth scanning rather than reading. */}
      <div className="mt-4 border-t border-rule">
        <div className="label hidden grid-cols-[3.5rem_11rem_1fr] gap-4 border-b border-rule py-2 sm:grid">
          <span className="text-right">Line</span>
          <span>Column</span>
          <span>What to fix</span>
        </div>

        {files.map(([file, rows]) => (
          <div key={file}>
            <p className="border-b border-rule bg-paper px-2 py-1.5 font-mono text-meta text-ink-soft">
              {file}
            </p>
            {rows.map((error, index) => (
              <div
                key={`${error.line}-${error.column}-${index}`}
                className="grid grid-cols-1 gap-x-4 border-b border-rule py-2 sm:grid-cols-[3.5rem_11rem_1fr]"
              >
                <span className="font-mono tabular-nums text-meta text-ink sm:text-right">
                  {error.line === null ? (
                    <span className="text-ink-soft">
                      <span className="sm:hidden">Whole file</span>
                      <span className="hidden sm:inline">—</span>
                    </span>
                  ) : (
                    <>
                      <span className="text-ink-soft sm:hidden">Line </span>
                      {error.line}
                    </>
                  )}
                </span>
                <span className="text-meta text-ink-soft">{error.column ?? ''}</span>
                <span className="text-meta text-ink">{error.message}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Keeps the API's ordering: files in sheet order, rows down the sheet. */
function groupByFile(errors: IngestionError[]): [SourceFile, IngestionError[]][] {
  const groups = new Map<SourceFile, IngestionError[]>();
  for (const error of errors) {
    const existing = groups.get(error.file);
    if (existing) existing.push(error);
    else groups.set(error.file, [error]);
  }
  return [...groups.entries()];
}
