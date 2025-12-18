// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from './ormconfig';
import { MigrationService } from './migration.service';

@Module({
  imports: [TypeOrmModule.forRoot(config)],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class DatabaseModule {}
