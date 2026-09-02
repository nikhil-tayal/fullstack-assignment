import { Controller, Get, Query } from '@nestjs/common';
import { RegistryService } from './registry.service';

/** A blank query parameter is the same as an unset one, not a filter on the empty string. */
const clean = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

@Controller('registry')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  @Get('status')
  status() {
    return this.registry.status();
  }

  @Get('entities')
  entities(
    @Query('search') search?: string,
    @Query('entityStatus') entityStatus?: string,
    @Query('complianceStatus') complianceStatus?: string,
    @Query('jurisdiction') jurisdiction?: string,
  ) {
    return this.registry.entities({
      search: clean(search),
      entityStatus: clean(entityStatus),
      complianceStatus: clean(complianceStatus),
      jurisdiction: clean(jurisdiction),
    });
  }
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly registry: RegistryService) {}

  @Get()
  analytics(
    @Query('jurisdiction') jurisdiction?: string,
    @Query('entityStatus') entityStatus?: string,
    @Query('parent') parent?: string,
  ) {
    return this.registry.analytics({
      jurisdiction: clean(jurisdiction),
      entityStatus: clean(entityStatus),
      parent: clean(parent),
    });
  }
}
