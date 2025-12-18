-- Migration: Create All Sequences and Required Tables
-- Date: 2024-12-18
-- Description: Creates all database sequences and ensures all tables exist for TypeORM entities
-- This migration should be run on the new database to set up the complete schema

-- ============================================================================
-- CREATE SEQUENCES FOR DISPLAY CODES
-- ============================================================================

-- User display codes (USR-000001, USR-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS user_display_seq START 1;

-- Organization display codes (ORG-000001, ORG-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS organization_display_seq START 1;

-- Property display codes (PROP-000001, PROP-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS property_display_seq START 1;

-- Transaction display codes (TXN-000001, TXN-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS transaction_display_seq START 1;

-- Investment display codes (INV-000001, INV-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS investment_display_seq START 1;

-- Reward display codes (RWD-000001, RWD-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS reward_display_seq START 1;

-- ============================================================================
-- VERIFICATION: Check that sequences were created
-- ============================================================================

-- You can verify sequences by running:
-- SELECT sequencename FROM pg_sequences WHERE schemaname = 'public';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON SEQUENCE user_display_seq IS 'Sequence for generating user display codes (USR-XXXXXX)';
COMMENT ON SEQUENCE organization_display_seq IS 'Sequence for generating organization display codes (ORG-XXXXXX)';
COMMENT ON SEQUENCE property_display_seq IS 'Sequence for generating property display codes (PROP-XXXXXX)';
COMMENT ON SEQUENCE transaction_display_seq IS 'Sequence for generating transaction display codes (TXN-XXXXXX)';
COMMENT ON SEQUENCE investment_display_seq IS 'Sequence for generating investment display codes (INV-XXXXXX)';
COMMENT ON SEQUENCE reward_display_seq IS 'Sequence for generating reward display codes (RWD-XXXXXX)';

-- ============================================================================
-- ENABLE UUID EXTENSION (required for uuid primary keys)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- NOTES
-- ============================================================================

-- After running this migration:
-- 1. TypeORM synchronize will create all tables based on entities
-- 2. The sequences will be used by services to generate display codes
-- 3. All display code generation will work correctly
--
-- If you're using TypeORM synchronize=true:
-- - Tables will be created automatically based on entity definitions
-- - Foreign keys and constraints will be added automatically
-- - Indexes will be created automatically
--
-- If you're NOT using TypeORM synchronize:
-- - You'll need to run additional migrations to create tables
-- - Or run TypeORM migration:generate and migration:run commands

