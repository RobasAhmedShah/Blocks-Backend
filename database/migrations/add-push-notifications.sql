-- Migration: Add Push Notifications Support
-- Date: 2025-01-XX
-- Description: Adds push notification support by:
--              1. Adding expoToken and webPushSubscription columns to users table
--              2. Creating notifications table for tracking sent notifications
--
-- IMPORTANT: This migration is for the push notifications feature branch
-- Run this on your Neon database branch: ep-soft-resonance-a1frot6e-pooler

-- ============================================================================
-- ADD PUSH TOKEN COLUMNS TO USERS TABLE
-- ============================================================================

-- Add Expo push token column (for React Native/Expo apps)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "expoToken" TEXT NULL;

-- Add Web Push subscription column (for Next.js web apps)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "webPushSubscription" TEXT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users."expoToken" IS 'Expo push notification token for React Native mobile app';
COMMENT ON COLUMN users."webPushSubscription" IS 'Web Push subscription JSON for Next.js web app';

-- ============================================================================
-- CREATE NOTIFICATIONS TABLE
-- ============================================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  platform VARCHAR(50) NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign key constraint with CASCADE DELETE
  CONSTRAINT notifications_userId_fkey 
    FOREIGN KEY ("userId") 
    REFERENCES users(id) 
    ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON notifications("createdAt");
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'Stores all push notifications sent to users';
COMMENT ON COLUMN notifications."userId" IS 'Reference to the user who received the notification';
COMMENT ON COLUMN notifications.title IS 'Notification title';
COMMENT ON COLUMN notifications.message IS 'Notification message body';
COMMENT ON COLUMN notifications.data IS 'Additional JSON data payload';
COMMENT ON COLUMN notifications.status IS 'Notification status: pending, sent, or failed';
COMMENT ON COLUMN notifications.platform IS 'Platform where notification was sent: expo or web';

-- ============================================================================
-- VERIFICATION QUERIES (Optional - run these to verify the migration)
-- ============================================================================

-- Verify users table has new columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- AND column_name IN ('expoToken', 'webPushSubscription');

-- Verify notifications table exists
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_name = 'notifications';

-- Verify foreign key constraint
-- SELECT 
--   tc.constraint_name, 
--   tc.table_name, 
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name,
--   rc.delete_rule
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- JOIN information_schema.referential_constraints AS rc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name = 'notifications';


