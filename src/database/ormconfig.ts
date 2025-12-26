// src/database/ormconfig.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DefaultNamingStrategy } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

// Custom naming strategy to preserve camelCase column names
class CamelCaseNamingStrategy extends DefaultNamingStrategy {
  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    // If custom name is provided in @Column({ name: '...' }), use it
    if (customName) {
      return customName;
    }
    // Otherwise, preserve the property name as-is (camelCase)
    return propertyName;
  }
}

const config: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: true,
  autoLoadEntities: true,
  // DISABLED: We use manual SQL migrations instead
  // WARNING: Never enable synchronize in production - it will drop/recreate tables!
  // Set ENABLE_SYNC=true in .env ONLY if you explicitly want to enable it (not recommended)
  synchronize: process.env.ENABLE_SYNC === 'true',
  // Use custom naming strategy to preserve camelCase column names
  namingStrategy: new CamelCaseNamingStrategy(),
  // Log SQL queries in development for debugging
  logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn', 'schema'] : ['error'],
  extra: {
    ssl: { rejectUnauthorized: false },
  },
};

export default config;
