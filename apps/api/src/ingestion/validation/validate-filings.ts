import { FILING_STATUSES, FILING_TYPES } from '../../domain/vocabulary';
import { IngestionError } from '../ingestion-error';
import { ParsedFile } from '../parsing/parse-file';
import { ValidFiling } from './records';
import { RowContext } from './row-context';
import { parseDate, parseEnum, parseJurisdiction } from './values';

/** Row-level validation of filings.csv. Entity Name is resolved in the cross-file pass. */
export function validateFilings(
  parsed: ParsedFile,
  today: Date,
): { filings: ValidFiling[]; errors: IngestionError[] } {
  const errors: IngestionError[] = [];
  const filings: ValidFiling[] = [];

  for (const row of parsed.rows) {
    const ctx = new RowContext('filings.csv', row);

    const entityName = ctx.required('Entity Name', (t) => ({ ok: true as const, value: t }));
    const filingType = ctx.required('Filing Type', (t) => parseEnum(t, FILING_TYPES, 'Filing Type'));
    const jurisdiction = ctx.required('Jurisdiction', parseJurisdiction);
    const filingAuthority = ctx.text('Filing Authority');
    const dueDate = ctx.required('Due Date', parseDate);
    const status = ctx.required('Status', (t) => parseEnum(t, FILING_STATUSES, 'Status'));
    const filedDate = ctx.optional('Filed Date', parseDate);

    // Filed Date and Status have to agree in both directions: a filed row without a
    // date leaves the record incomplete, and a date on a row that is not filed says
    // the status is stale.
    if (status === 'Filed' && ctx.raw('Filed Date') === '') {
      ctx.add('Filed Date', 'Filed Date is required when Status is Filed. Enter the date it was filed');
    }
    if (filedDate !== null && status !== null && status !== 'Filed') {
      ctx.add(
        'Filed Date',
        `Filed Date is set but Status is ${status}. Either change Status to Filed, or clear the Filed Date`,
      );
    }
    if (filedDate !== null && filedDate > today) {
      ctx.add(
        'Filed Date',
        `Filed Date ${ctx.raw('Filed Date')} is in the future. A filing cannot already have been filed`,
      );
    }

    errors.push(...ctx.drain());
    if (ctx.failed) continue;

    filings.push({
      line: row.line,
      entityName: entityName!,
      filingType: filingType!,
      jurisdiction: jurisdiction!,
      filingAuthority,
      dueDate: dueDate!,
      filedDate,
      status: status!,
    });
  }

  return { filings, errors };
}
