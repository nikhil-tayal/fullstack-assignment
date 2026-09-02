import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  UnprocessableEntityException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ERROR_CLASSES, ErrorClass, SourceFile } from './ingestion-error';
import { IngestionService, UploadedFile } from './ingestion.service';

/** The form field each file arrives under, and the sheet it stands for. */
const FIELDS: { field: 'entities' | 'ownership' | 'filings'; file: SourceFile }[] = [
  { field: 'entities', file: 'entities.csv' },
  { field: 'ownership', file: 'ownership.csv' },
  { field: 'filings', file: 'filings.csv' },
];

/** Generous for a registry export, small enough that a mis-drop cannot exhaust memory. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type UploadFields = Partial<Record<'entities' | 'ownership' | 'filings', UploadedFile[]>>;

@Controller('uploads')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  /**
   * All three files, one request, one answer.
   *
   * The spec is specific that this is a single server-side operation, and it matters
   * for more than tidiness: the cross-file and graph rules cannot be checked unless
   * all three sheets are present at once, so uploading them one at a time could never
   * produce the full set of errors.
   */
  @Post()
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      FIELDS.map(({ field }) => ({ name: field, maxCount: 1 })),
      { limits: { fileSize: MAX_FILE_BYTES, files: 3 } },
    ),
  )
  async upload(@UploadedFiles() uploaded: UploadFields) {
    const files = {} as Record<SourceFile, UploadedFile>;
    const missing: string[] = [];

    for (const { field, file } of FIELDS) {
      const received = uploaded?.[field]?.[0];
      if (received) files[file] = received;
      else missing.push(field);
    }

    if (missing.length > 0) {
      throw new BadRequestException({
        message: `Attach all three files before uploading. Still needed: ${missing.join(', ')}.`,
        missing,
      });
    }

    const outcome = await this.ingestion.ingest(files);

    if (!outcome.ok) {
      // 422 rather than 400: the request was well formed, and it is the contents of
      // the spreadsheets that we cannot accept. The whole list goes back in one
      // response so the user can fix everything before trying again.
      const byClass = Object.fromEntries(
        ERROR_CLASSES.map((cls) => [cls, outcome.errors.filter((e) => e.class === cls).length]),
      ) as Record<ErrorClass, number>;

      throw new UnprocessableEntityException({
        message: `Nothing was saved. ${outcome.errors.length} ${
          outcome.errors.length === 1 ? 'problem needs' : 'problems need'
        } fixing in the files.`,
        errors: outcome.errors,
        summary: { total: outcome.errors.length, byClass },
      });
    }

    return {
      message: outcome.result.changed
        ? 'Registry updated.'
        : 'These files match what is already stored, so nothing changed.',
      changed: outcome.result.changed,
      counts: {
        entities: outcome.result.entityCount,
        ownership: outcome.result.ownershipCount,
        filings: outcome.result.filingCount,
      },
    };
  }
}
