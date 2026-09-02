import { IngestionError, sortErrors } from '../ingestion-error';
import { ParsedFile } from '../parsing/parse-file';
import { ValidDataset } from './records';
import { validateEntities } from './validate-entities';
import { validateFilings } from './validate-filings';
import { validateGraph } from './validate-graph';
import { validateOwnership } from './validate-ownership';
import { indexDeclaredEntities, validateReferences } from './validate-references';

export type ValidationResult =
  | { ok: true; dataset: ValidDataset }
  | { ok: false; errors: IngestionError[] };

/**
 * Validates the three sheets together and reports everything wrong with them at once,
 * because the point of the exercise is that the user fixes their spreadsheet in one
 * sitting rather than discovering the next fault on the next upload.
 *
 * Three passes run, ordered by what each needs to know:
 *
 *   1. row       - each sheet judged against itself
 *   2. reference - names resolved across sheets, and the FQ rules applied
 *   3. graph     - the ownership edges judged as a whole
 *
 * All three always run and their findings are reported together. What the ordering
 * buys is not early exit but silence about consequences: each pass only sees the rows
 * that survived the one before, so a row with an unreadable percentage is reported as
 * an unreadable percentage and not also as breaking an ownership total. One fault, one
 * message.
 */
export function validateDataset(
  files: { entities: ParsedFile; ownership: ParsedFile; filings: ParsedFile },
  today: Date,
): ValidationResult {
  const entityResult = validateEntities(files.entities, today);
  const ownershipResult = validateOwnership(files.ownership);
  const filingResult = validateFilings(files.filings, today);

  // Entities as the sheet declares them, including rows that failed validation above.
  // A row dropped for a bad Global Region still declares its entity, and the ownership
  // rows pointing at it should not also be accused of naming something that does not
  // exist when the user is already being told to fix that row.
  const declared = indexDeclaredEntities(files.entities);

  const errors: IngestionError[] = [
    ...entityResult.errors,
    ...ownershipResult.errors,
    ...filingResult.errors,
    ...validateReferences(declared, ownershipResult.ownership, filingResult.filings),
    ...validateGraph(ownershipResult.ownership),
  ];

  if (errors.length > 0) return { ok: false, errors: sortErrors(errors) };

  return {
    ok: true,
    dataset: {
      entities: entityResult.entities,
      ownership: ownershipResult.ownership,
      filings: filingResult.filings,
    },
  };
}
