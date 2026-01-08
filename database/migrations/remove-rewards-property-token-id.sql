-- Migration: Remove property_token_id from rewards table
-- Date: 2026-01-08
-- Description: Removes redundant property_token_id column from rewards table.
--              The propertyTokenId can be accessed via reward.investment.propertyTokenId,
--              making this column redundant and causing sync issues.
--
-- ============================================================================
-- REMOVE PROPERTY_TOKEN_ID FROM REWARDS TABLE
-- ============================================================================

-- Drop foreign key constraint first (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_rewards_property_token'
  ) THEN
    ALTER TABLE rewards
    DROP CONSTRAINT fk_rewards_property_token;
  END IF;
END $$;

-- Drop index (if it exists)
DROP INDEX IF EXISTS idx_rewards_property_token_id;

-- Drop column (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' 
    AND column_name = 'property_token_id'
  ) THEN
    ALTER TABLE rewards 
    DROP COLUMN property_token_id;
  END IF;
END $$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE rewards IS 'Rewards are linked to investments. To access propertyTokenId, use reward.investment.propertyTokenId instead of the removed reward.propertyTokenId column.';

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- To query rewards for a specific token tier, use:
--   SELECT r.* FROM rewards r
--   INNER JOIN investments i ON i.id = r.investment_id
--   WHERE i.property_token_id = 'token-uuid' 
--   AND r.type = 'roi';
--
-- To access propertyTokenId in code:
--   reward.investment.propertyTokenId (instead of reward.propertyTokenId)
--

