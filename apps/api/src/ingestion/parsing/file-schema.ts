import { SourceFile } from '../ingestion-error';

/**
 * The header each file must carry, in order. The spec fixes both the names and the
 * order, and the sample files rely on position, so a header that does not match
 * exactly is a structural fault rather than something to guess around.
 */
export const FILE_COLUMNS: Record<SourceFile, readonly string[]> = {
  'entities.csv': [
    'Entity Name',
    'Registration Type',
    'Jurisdiction',
    'Entity Type',
    'Entity Status',
    'Status Date',
    'Domestic Entity',
    'Formation Date',
    'Entity/Business ID',
    'Global Region',
  ],
  'ownership.csv': ['Parent Entity', 'Child Entity', 'Ownership %'],
  'filings.csv': [
    'Entity Name',
    'Filing Type',
    'Jurisdiction',
    'Filing Authority',
    'Due Date',
    'Filed Date',
    'Status',
  ],
} as const;
