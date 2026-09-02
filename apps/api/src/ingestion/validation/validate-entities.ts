import {
  ENTITY_STATUSES,
  ENTITY_TYPES,
  GLOBAL_REGIONS,
  REGISTRATION_TYPES,
} from '../../domain/vocabulary';
import { IngestionError } from '../ingestion-error';
import { ParsedFile } from '../parsing/parse-file';
import { ValidEntity } from './records';
import { RowContext } from './row-context';
import { parseDate, parseEnum, parseJurisdiction } from './values';

/**
 * Row-level validation of entities.csv, plus the two uniqueness rules that need the
 * whole sheet in hand (Entity Name, Entity/Business ID). References out of the sheet —
 * Domestic Entity naming a real Entity row — are deliberately left to the cross-file
 * pass, since they cannot be settled until every row here is known.
 */
export function validateEntities(
  parsed: ParsedFile,
  today: Date,
): { entities: ValidEntity[]; errors: IngestionError[] } {
  const errors: IngestionError[] = [];
  const entities: ValidEntity[] = [];

  const nameFirstSeen = new Map<string, number>();
  const idFirstSeen = new Map<string, number>();

  for (const row of parsed.rows) {
    const ctx = new RowContext('entities.csv', row);

    const name = ctx.required('Entity Name', (t) => ({ ok: true as const, value: t }));
    const registrationType = ctx.required('Registration Type', (t) =>
      parseEnum(t, REGISTRATION_TYPES, 'Registration Type'),
    );
    const jurisdiction = ctx.required('Jurisdiction', parseJurisdiction);
    const entityType = ctx.required('Entity Type', (t) => parseEnum(t, ENTITY_TYPES, 'Entity Type'));
    const entityStatus = ctx.required('Entity Status', (t) => parseEnum(t, ENTITY_STATUSES, 'Entity Status'));

    // Status Date earns its keeping only once we know the status, so it is checked
    // conditionally rather than as a plain required/optional cell.
    const statusDate = ctx.optional('Status Date', parseDate);
    const settledStatus = entityStatus !== null && entityStatus !== 'In Formation' && entityStatus !== 'Active';
    if (settledStatus && ctx.raw('Status Date') === '') {
      ctx.add(
        'Status Date',
        `Status Date is required when Entity Status is ${entityStatus}. Enter the date the status took effect`,
      );
    }

    const domesticEntityName = ctx.text('Domestic Entity');
    if (registrationType === 'FQ' && domesticEntityName === null) {
      ctx.add(
        'Domestic Entity',
        'Domestic Entity is required on an FQ row. Name the entity this is a foreign qualification of',
      );
    }
    if (registrationType === 'Entity' && domesticEntityName !== null) {
      ctx.add(
        'Domestic Entity',
        `Domestic Entity must be empty on an Entity row. "${domesticEntityName}" belongs only on an FQ row — if this row is a foreign qualification, set Registration Type to FQ`,
      );
    }

    const formationDate = ctx.optional('Formation Date', parseDate);
    if (formationDate !== null && formationDate > today) {
      ctx.add(
        'Formation Date',
        `Formation Date ${ctx.raw('Formation Date')} is in the future. Correct it to the date the entity was actually formed`,
      );
    }

    const businessId = ctx.text('Entity/Business ID');
    const globalRegion = ctx.optional('Global Region', (t) => parseEnum(t, GLOBAL_REGIONS, 'Global Region'));

    // Uniqueness is reported on the later row, pointing back at the first, because the
    // first occurrence is the one the user most likely wants to keep.
    if (name !== null) {
      const first = nameFirstSeen.get(name);
      if (first !== undefined) {
        ctx.add(
          'Entity Name',
          `"${name}" is already used on line ${first}. Entity Name has to be unique — rename this row or remove it`,
        );
      } else {
        nameFirstSeen.set(name, row.line);
      }
    }
    if (businessId !== null) {
      const first = idFirstSeen.get(businessId);
      if (first !== undefined) {
        ctx.add(
          'Entity/Business ID',
          `"${businessId}" is already used on line ${first}. Give this row its own ID, or leave the cell empty`,
        );
      } else {
        idFirstSeen.set(businessId, row.line);
      }
    }

    errors.push(...ctx.drain());
    if (ctx.failed) continue;

    entities.push({
      line: row.line,
      name: name!,
      registrationType: registrationType!,
      jurisdiction: jurisdiction!,
      entityType: entityType!,
      entityStatus: entityStatus!,
      statusDate,
      domesticEntityName,
      formationDate,
      businessId,
      globalRegion,
    });
  }

  return { entities, errors };
}
