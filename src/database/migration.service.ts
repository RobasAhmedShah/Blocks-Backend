import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    // Ensure required sequences exist in all environments.
    // TypeORM synchronize does not create standalone custom sequences like user_display_seq.
    await this.ensureSequencesExist();
  }

  /**
   * Ensures all required sequences exist in the database
   * This is critical for display code generation
   */
  async ensureSequencesExist() {
    try {
      const sequences = [
        'user_display_seq',
        'organization_display_seq',
        'property_display_seq',
        'transaction_display_seq',
        'investment_display_seq',
        'reward_display_seq',
      ];

      this.logger.log('Checking database sequences...');

      for (const seqName of sequences) {
        await this.dataSource.query(
          `CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1;`
        );
      }

      this.logger.log('✅ All sequences verified/created successfully');
    } catch (error) {
      this.logger.error('Failed to create sequences:', error);
      throw error;
    }
  }

  /**
   * Manually run this to ensure UUID extension is enabled
   */
  async ensureUuidExtension() {
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      this.logger.log('✅ UUID extension verified');
    } catch (error) {
      this.logger.error('Failed to create UUID extension:', error);
      throw error;
    }
  }
}

