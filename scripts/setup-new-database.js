#!/usr/bin/env node

/**
 * Setup script for new database
 * This script creates all required sequences in the database
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    console.log('📦 Creating sequences...');
    
    const sequences = [
      'user_display_seq',
      'organization_display_seq',
      'property_display_seq',
      'transaction_display_seq',
      'investment_display_seq',
      'reward_display_seq',
    ];

    for (const seqName of sequences) {
      await client.query(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1;`);
      console.log(`  ✅ ${seqName}`);
    }

    console.log('\n📦 Creating UUID extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('  ✅ uuid-ossp extension\n');

    console.log('🔍 Verifying sequences...');
    const result = await client.query(
      "SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename;"
    );

    console.log('\n📋 Sequences in database:');
    result.rows.forEach(row => {
      console.log(`  - ${row.sequencename}`);
    });

    console.log('\n✅ Database setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run start:dev (to sync tables via TypeORM)');
    console.log('2. Or set ENABLE_SYNC=true in Vercel and deploy');
    console.log('3. Test user registration to verify sequences work\n');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run setup
setupDatabase();

