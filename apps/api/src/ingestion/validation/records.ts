import {
  EntityStatus,
  EntityType,
  FilingStatus,
  FilingType,
  GlobalRegion,
  RegistrationType,
} from '../../domain/vocabulary';

/**
 * What a row looks like once it has survived validation: every value already parsed to
 * its real type, so nothing downstream re-reads a string. The line is kept so that a
 * fault found later — in the graph, say — can still be traced back to the sheet.
 */
export interface ValidEntity {
  line: number;
  name: string;
  registrationType: RegistrationType;
  jurisdiction: string;
  entityType: EntityType;
  entityStatus: EntityStatus;
  statusDate: Date | null;
  domesticEntityName: string | null;
  formationDate: Date | null;
  businessId: string | null;
  globalRegion: GlobalRegion | null;
}

export interface ValidOwnership {
  line: number;
  parentName: string;
  childName: string;
  percent: number;
}

export interface ValidFiling {
  line: number;
  entityName: string;
  filingType: FilingType;
  jurisdiction: string;
  filingAuthority: string | null;
  dueDate: Date;
  filedDate: Date | null;
  status: FilingStatus;
}

export interface ValidDataset {
  entities: ValidEntity[];
  ownership: ValidOwnership[];
  filings: ValidFiling[];
}
