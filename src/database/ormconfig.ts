// src/database/ormconfig.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const config: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: true,
  autoLoadEntities: true,
  // Enable synchronize in development/local to sync schema changes
  // WARNING: This will auto-create/update tables based on entities
  // Set NODE_ENV=production to disable synchronize in production
  synchronize: process.env.NODE_ENV !== 'production' || process.env.ENABLE_SYNC === 'false',
  // Log SQL queries in development for debugging
  logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn', 'schema'] : ['error'],
  extra: {
    ssl: { rejectUnauthorized: false },
  },
};

export default config;
