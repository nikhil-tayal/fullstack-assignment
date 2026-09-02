import { IngestionError } from '../ingestion-error';
import { ParsedFile } from '../parsing/parse-file';
import { ValidFiling, ValidOwnership } from './records';

/**
 * An entity as the sheet declares it, whether or not its row survived validation.
 *
 * References are resolved against these rather than against the validated rows,
 * because the two questions are independent: an entity is declared, and therefore
 * referable, even if some other cell on its row is wrong. Resolving against validated
 * rows only would report a name as non-existent purely because the row it names has an
 * unrelated fault, sending the user after a second, imaginary problem.
 */
interface DeclaredEntity {
  name: string;
  line: number;
  /** Raw text. The FQ rules apply only when it is one of the two known values. */
  registrationType: string;
  domesticEntityName: string | null;
}

export function indexDeclaredEntities(parsed: ParsedFile): Map<string, DeclaredEntity> {
  const declared = new Map<string, DeclaredEntity>();
  for (const row of parsed.rows) {
    const name = row.cells['Entity Name'];
    // A duplicate name is a row error on the later row; the first declaration wins here.
    if (name === '' || declared.has(name)) continue;
    declared.set(name, {
      name,
      line: row.line,
      registrationType: row.cells['Registration Type'],
      domesticEntityName: row.cells['Domestic Entity'] || null,
    });
  }
  return declared;
}

const nearestName = (name: string, known: Iterable<string>): string | null => {
  const target = name.toLowerCase().replace(/\s+/g, ' ');
  for (const candidate of known) {
    // Only offered for the differences a spreadsheet actually produces: casing and
    // stray whitespace. Anything looser risks pointing the user at the wrong entity.
    if (candidate.toLowerCase().replace(/\s+/g, ' ') === target) return candidate;
  }
  return null;
};

function missingEntity(name: string, known: Iterable<string>): string {
  const near = nearestName(name, known);
  return near !== null
    ? `"${name}" does not match any row in entities.csv, though "${near}" is close. Entity Name has to match exactly, including capitalisation and spacing`
    : `"${name}" does not exist in entities.csv. Add the entity there, or correct the name here`;
}

/**
 * The cross-file pass: every place one file names a row in another.
 *
 * These cannot be settled row by row, because a name can only be judged against the
 * finished entities sheet. It is also where the FQ/subsidiary distinction is enforced,
 * since what a reference may point at depends on which of the two it resolves to: an
 * FQ is one legal entity registered a second time, so it files in its own right, but
 * it cannot be owned and it cannot own.
 */
export function validateReferences(
  declared: Map<string, DeclaredEntity>,
  ownership: ValidOwnership[],
  filings: ValidFiling[],
): IngestionError[] {
  const errors: IngestionError[] = [];
  const names = () => declared.keys();
  const isFq = (e: DeclaredEntity) => e.registrationType === 'FQ';

  for (const entity of declared.values()) {
    if (entity.domesticEntityName === null) continue;
    const target = declared.get(entity.domesticEntityName);

    if (target === undefined) {
      errors.push({
        file: 'entities.csv',
        line: entity.line,
        column: 'Domestic Entity',
        class: 'reference',
        message: missingEntity(entity.domesticEntityName, names()),
      });
    } else if (target.name === entity.name) {
      errors.push({
        file: 'entities.csv',
        line: entity.line,
        column: 'Domestic Entity',
        class: 'reference',
        message:
          'An FQ cannot be its own Domestic Entity. Name the home registration this row is a foreign qualification of',
      });
    } else if (isFq(target)) {
      // A foreign qualification of a foreign qualification is not a thing: an FQ is a
      // second registration of one domestic entity, so the chain is always one step.
      errors.push({
        file: 'entities.csv',
        line: entity.line,
        column: 'Domestic Entity',
        class: 'reference',
        message: `"${target.name}" is itself an FQ (line ${target.line}). Domestic Entity has to name a home registration, so ${
          target.domesticEntityName === null
            ? 'name the entity that row is a foreign qualification of'
            : `use "${target.domesticEntityName}" instead`
        }`,
      });
    }
  }

  for (const edge of ownership) {
    const parent = declared.get(edge.parentName);
    const child = declared.get(edge.childName);

    if (parent === undefined) {
      errors.push({
        file: 'ownership.csv',
        line: edge.line,
        column: 'Parent Entity',
        class: 'reference',
        message: missingEntity(edge.parentName, names()),
      });
    } else if (isFq(parent)) {
      // An FQ is the same legal entity as its domestic registration, so anything it
      // owns is owned by that entity. Recording it here would double-count.
      errors.push({
        file: 'ownership.csv',
        line: edge.line,
        column: 'Parent Entity',
        class: 'reference',
        message: `"${parent.name}" is an FQ (line ${parent.line}) and cannot own anything. ${
          parent.domesticEntityName === null
            ? 'Record the ownership against the entity it is a foreign qualification of instead'
            : `It is the same legal entity as "${parent.domesticEntityName}", so record the ownership against "${parent.domesticEntityName}" instead`
        }`,
      });
    }

    if (child === undefined) {
      errors.push({
        file: 'ownership.csv',
        line: edge.line,
        column: 'Child Entity',
        class: 'reference',
        message: missingEntity(edge.childName, names()),
      });
    } else if (isFq(child)) {
      errors.push({
        file: 'ownership.csv',
        line: edge.line,
        column: 'Child Entity',
        class: 'reference',
        message: `"${child.name}" is an FQ (line ${child.line}) and cannot be owned. It is ${
          child.domesticEntityName === null
            ? 'one legal entity registered in another jurisdiction'
            : `the same legal entity as "${child.domesticEntityName}", registered in another jurisdiction`
        }, not a subsidiary, so remove this row`,
      });
    }
  }

  for (const filing of filings) {
    // Filings are the one reference that may point at an FQ: a foreign qualification
    // is a registration in its own right and files in its own jurisdiction.
    if (!declared.has(filing.entityName)) {
      errors.push({
        file: 'filings.csv',
        line: filing.line,
        column: 'Entity Name',
        class: 'reference',
        message: missingEntity(filing.entityName, names()),
      });
    }
  }

  return errors;
}
