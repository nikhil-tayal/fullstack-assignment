import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { RegistryWriter } from './persistence/registry-writer';

@Module({
  controllers: [IngestionController],
  providers: [IngestionService, RegistryWriter],
})
export class IngestionModule {}
