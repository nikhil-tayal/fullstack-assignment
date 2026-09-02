import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidDataset } from '../validation/records';

export interface WriteResult {
  /** False when the uploaded set is byte-identical to what is already stored. */
  changed: boolean;
  entityCount: number;
  ownershipCount: number;
  filingCount: number;
}

@Injectable()
export class RegistryWriter {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Replaces the registry with the uploaded dataset, in a single transaction.
   *
   * The write is a snapshot replace rather than a merge, which is what makes a
   * re-upload safe in both directions: uploading the same files twice leaves exactly
   * one copy of everything, and uploading a corrected set removes the rows the user
   * deleted instead of leaving them behind as orphans. There is one registry, and an
   * upload is the whole of it.
   *
   * Doing it inside one transaction is what satisfies "nothing written if there are
   * errors" at the storage layer too: a failure part-way through rolls back to the
   * previous contents rather than leaving a half-replaced registry.
   */
  async replace(dataset: ValidDataset): Promise<WriteResult> {
    const fingerprint = fingerprintOf(dataset);
    const counts = {
      entityCount: dataset.entities.length,
      ownershipCount: dataset.ownership.length,
      filingCount: dataset.filings.length,
    };

    const current = await this.prisma.upload.findFirst({ orderBy: { createdAt: 'desc' } });
    if (current?.fingerprint === fingerprint) {
      return { changed: false, ...counts };
    }

    await this.prisma.$transaction(async (tx) => {
      // Order matters on the way out only because it makes the intent explicit —
      // the schema cascades from Entity — and it keeps the delete readable.
      await tx.filing.deleteMany();
      await tx.ownership.deleteMany();
      await tx.entity.deleteMany();
      await tx.upload.deleteMany();

      // Entities go in before the rows that reference them: the foreign keys are on
      // Entity Name, so ownership and filings would have nothing to point at.
      // FQ rows are written after their domestic entities for the same reason.
      const entities = [...dataset.entities].sort(
        (a, b) => Number(a.registrationType === 'FQ') - Number(b.registrationType === 'FQ'),
      );
      for (const entity of entities) {
        await tx.entity.create({
          data: {
            name: entity.name,
            registrationType: entity.registrationType,
            jurisdiction: entity.jurisdiction,
            entityType: entity.entityType,
            entityStatus: entity.entityStatus,
            statusDate: entity.statusDate,
            formationDate: entity.formationDate,
            businessId: entity.businessId,
            globalRegion: entity.globalRegion,
            domesticEntityName: entity.domesticEntityName,
          },
        });
      }

      await tx.ownership.createMany({
        data: dataset.ownership.map((o) => ({
          parentName: o.parentName,
          childName: o.childName,
          percent: o.percent,
        })),
      });

      await tx.filing.createMany({
        data: dataset.filings.map((f) => ({
          entityName: f.entityName,
          filingType: f.filingType,
          jurisdiction: f.jurisdiction,
          filingAuthority: f.filingAuthority,
          dueDate: f.dueDate,
          filedDate: f.filedDate,
          status: f.status,
        })),
      });

      await tx.upload.create({
        data: {
          fingerprint,
          entityCount: counts.entityCount,
          ownerCount: counts.ownershipCount,
          filingCount: counts.filingCount,
        },
      });
    });

    return { changed: true, ...counts };
  }
}

/**
 * A hash of the dataset's meaning, not of the bytes uploaded.
 *
 * Taken over the validated records rather than the raw files, so that the same data
 * re-exported from Excel, or with its rows reordered, or with a stray blank line, is
 * recognised as the same registry. Line numbers are excluded for the same reason:
 * where a row sat in the sheet is not part of what it says. Fields are joined on a
 * NUL so that no run of values can be re-read as a different one.
 */
function fingerprintOf(dataset: ValidDataset): string {
  const day = (d: Date | null) => (d === null ? '' : d.toISOString().slice(0, 10));

  const entities = dataset.entities
    .map((e) =>
      [
        e.name,
        e.registrationType,
        e.jurisdiction,
        e.entityType,
        e.entityStatus,
        day(e.statusDate),
        e.domesticEntityName ?? '',
        day(e.formationDate),
        e.businessId ?? '',
        e.globalRegion ?? '',
      ].join('\u0000'),
    )
    .sort();

  const ownership = dataset.ownership
    .map((o) => [o.parentName, o.childName, o.percent.toFixed(2)].join('\u0000'))
    .sort();

  const filings = dataset.filings
    .map((f) =>
      [
        f.entityName,
        f.filingType,
        f.jurisdiction,
        f.filingAuthority ?? '',
        day(f.dueDate),
        day(f.filedDate),
        f.status,
      ].join('\u0000'),
    )
    .sort();

  return createHash('sha256')
    .update([entities.join('\n'), ownership.join('\n'), filings.join('\n')].join('\u0001'))
    .digest('hex');
}
