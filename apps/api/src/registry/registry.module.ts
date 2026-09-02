import { Module } from '@nestjs/common';
import { AnalyticsController, RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';

@Module({
  controllers: [RegistryController, AnalyticsController],
  providers: [RegistryService],
})
export class RegistryModule {}
