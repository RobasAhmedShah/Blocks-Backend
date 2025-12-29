-- Migration: Fix Missing Columns in Production
-- Date: 2025-01-XX
-- Description: Adds all missing columns that exist in entities but not in production database
-- This migration fixes the issue where columns disappear when ENABLE_SYNC=false
--
-- ROOT CAUSE:
-- - TypeORM synchronize was used in development to auto-create columns
-- - Production has synchronize=false, so columns must be added via migrations
-- - This migration ensures all entity-defined columns exist in production
--
-- IMPORTANT: Run this migration in your production database (Vercel/Neon)

-- ============================================================================
-- USERS TABLE - Add Missing Columns
-- ============================================================================

-- Add password column (nullable, with select: false in entity)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password VARCHAR(255) NULL;

-- Add date of birth column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "dob" DATE NULL;

-- Add address column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "address" TEXT NULL;

-- Add profile image URL column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "profileImage" VARCHAR(500) NULL;

-- Add Expo push token column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "expoToken" TEXT NULL;

-- Add Web Push subscription column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "webPushSubscription" TEXT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.password IS 'User password hash (nullable, select: false in entity)';
COMMENT ON COLUMN users."dob" IS 'Date of birth';
COMMENT ON COLUMN users."address" IS 'User physical address';
COMMENT ON COLUMN users."profileImage" IS 'URL to user profile image';
COMMENT ON COLUMN users."expoToken" IS 'Expo push notification token for React Native mobile app';
COMMENT ON COLUMN users."webPushSubscription" IS 'Web Push subscription JSON for Next.js web app';

-- ============================================================================
-- PROPERTIES TABLE - Add Missing Columns
-- ============================================================================

-- Add documents JSONB column
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS "documents" JSONB NULL;

COMMENT ON COLUMN properties."documents" IS 'Property-specific documents (metadata, URLs, etc.) stored as JSONB';

-- ============================================================================
-- CREATE INDEXES (if not already exist)
-- ============================================================================

-- Index on users.email for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================

-- Verify all users columns exist
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- AND column_name IN ('password', 'dob', 'address', 'profileImage', 'expoToken', 'webPushSubscription')
-- ORDER BY column_name;

-- Verify properties documents column exists
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'properties' 
-- AND column_name = 'documents';






