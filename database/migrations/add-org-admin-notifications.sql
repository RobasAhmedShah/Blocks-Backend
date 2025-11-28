-- Migration: Add organization admin notifications support
-- This migration extends the notifications table to support both users and organization admins
-- Also adds web push subscription support for organization admins

-- Step 1: Add webPushSubscription to organization_admins table
ALTER TABLE organization_admins 
  ADD COLUMN IF NOT EXISTS "webPushSubscription" text NULL;

-- Step 2: Make userId nullable in notifications table (to support org admins)
-- First, check if there are any NOT NULL constraints
DO $$
BEGIN
  -- Drop NOT NULL constraint if it exists
  ALTER TABLE notifications ALTER COLUMN "userId" DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might not exist, that's okay
    RAISE NOTICE 'userId column may already be nullable or constraint does not exist';
END $$;

-- Step 3: Add organizationAdminId column to notifications table
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS "organizationAdminId" uuid NULL;

-- Step 4: Add recipientType column to distinguish notification recipients
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS "recipientType" varchar(20) DEFAULT 'user' CHECK ("recipientType" IN ('user', 'org_admin', 'blocks_admin'));

-- Step 5: Add foreign key constraint for organizationAdminId
DO $$
BEGIN
  ALTER TABLE notifications 
    ADD CONSTRAINT "FK_org_admin_notification" 
    FOREIGN KEY ("organizationAdminId") 
    REFERENCES organization_admins(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Foreign key constraint FK_org_admin_notification already exists';
END $$;

-- Step 6: Add check constraint to ensure either userId or organizationAdminId is set
DO $$
BEGIN
  ALTER TABLE notifications 
    ADD CONSTRAINT "check_notification_recipient" 
    CHECK (
      ("userId" IS NOT NULL AND "organizationAdminId" IS NULL) OR 
      ("userId" IS NULL AND "organizationAdminId" IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Check constraint check_notification_recipient already exists';
END $$;

-- Step 7: Create index on organizationAdminId for faster queries
CREATE INDEX IF NOT EXISTS "IDX_notifications_organizationAdminId" 
  ON notifications("organizationAdminId");

-- Step 8: Create index on recipientType for filtering
CREATE INDEX IF NOT EXISTS "IDX_notifications_recipientType" 
  ON notifications("recipientType");

-- Verification queries (commented out - uncomment to verify)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'notifications' 
-- AND column_name IN ('userId', 'organizationAdminId', 'recipientType');

-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'organization_admins' 
-- AND column_name = 'webPushSubscription';

