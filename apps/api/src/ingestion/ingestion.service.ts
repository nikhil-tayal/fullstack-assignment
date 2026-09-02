import { Injectable } from '@nestjs/common';
import { IngestionError, SOURCE_FILES, SourceFile, sortErrors } from './ingestion-error';
import { ParsedFile, parseFile } from './parsing/parse-file';
import { RegistryWriter, WriteResult } from './persistence/registry-writer';
import { validateEntities } from './validation/validate-entities';
import { validateFilings } from './validation/validate-filings';
import { validateOwnership } from './validation/validate-ownership';
import { validateDataset } from './validation/validate';

/** One uploaded file, as it arrived. */
export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

export type IngestionOutcome =
  | { ok: true; result: WriteResult }
  | { ok: false; errors: IngestionError[] };

@Injectable()
export class IngestionService {
  constructor(private readonly writer: RegistryWriter) {}

  /**
   * Parse, validate and store all three files as one operation.
   *
   * The three stages are kept separate on purpose — parsing knows about file formats
   * and nothing else, validation knows about the rules and nothing about storage, and
   * the writer knows about neither. Nothing reaches the writer unless every rule
   * passed, which is what "nothing is written if there are errors" means here.
   */
  async ingest(files: Record<SourceFile, UploadedFile>, today = new Date()): Promise<IngestionOutcome> {
    const parsed = {} as Record<SourceFile, ParsedFile>;
    const structural: IngestionError[] = [];

    for (const name of SOURCE_FILES) {
      const file = files[name];
      const result = await parseFile(name, file.originalname, file.buffer);
      if (result.ok) parsed[name] = result.parsed;
      else structural.push(...result.errors);
    }

    if (structural.length > 0) {
      // A file whose header we cannot read has no columns to validate against, so its
      // own rows are skipped. The other files are still checked, because the user
      // should not have to fix the header, re-upload, and only then learn what else is
      // wrong. Cross-file and graph rules are the exception: both need all three
      // sheets, so they wait for the next upload.
      return { ok: false, errors: sortErrors([...structural, ...rowErrorsFor(parsed, today)]) };
    }

    const validation = validateDataset(
      { entities: parsed['entities.csv'], ownership: parsed['ownership.csv'], filings: parsed['filings.csv'] },
      today,
    );
    if (!validation.ok) return { ok: false, errors: validation.errors };

    return { ok: true, result: await this.writer.replace(validation.dataset) };
  }
}

function rowErrorsFor(parsed: Partial<Record<SourceFile, ParsedFile>>, today: Date): IngestionError[] {
  const errors: IngestionError[] = [];
  const entities = parsed['entities.csv'];
  const ownership = parsed['ownership.csv'];
  const filings = parsed['filings.csv'];

  if (entities) errors.push(...validateEntities(entities, today).errors);
  if (ownership) errors.push(...validateOwnership(ownership).errors);
  if (filings) errors.push(...validateFilings(filings, today).errors);
  return errors;
}
