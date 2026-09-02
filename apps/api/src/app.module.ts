import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { IngestionModule } from './ingestion/ingestion.module';
import { PrismaModule } from './prisma/prisma.module';
import { RegistryModule } from './registry/registry.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, IngestionModule, RegistryModule],
  controllers: [HealthController],
})
export class AppModule {}
