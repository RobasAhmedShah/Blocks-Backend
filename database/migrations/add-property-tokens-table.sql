-- Migration: Create Property Tokens Table
-- Date: 2025-12-31
-- Description: Creates property_tokens table for multi-token feature
--              Each property can have multiple token tiers (Bronze, Gold, Platinum, etc.)
--              with different prices, ROI, and apartment types
--
-- ============================================================================
-- CREATE PROPERTY TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_code VARCHAR(32) UNIQUE NOT NULL,
  property_id UUID NOT NULL,
  
  -- Token Identity
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL,
  
  -- Token Economics
  price_per_token_usdt NUMERIC(18, 6) NOT NULL,
  total_tokens NUMERIC(18, 6) NOT NULL,
  available_tokens NUMERIC(18, 6) NOT NULL,
  expected_roi NUMERIC(5, 2) NOT NULL,
  
  -- Apartment/Unit Details
  apartment_type VARCHAR(100),
  apartment_features JSONB,
  
  -- Metadata
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT property_tokens_property_id_fkey 
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR EFFICIENT QUERYING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_property_tokens_property_id 
ON property_tokens(property_id);

CREATE INDEX IF NOT EXISTS idx_property_tokens_display_code 
ON property_tokens(display_code);

CREATE INDEX IF NOT EXISTS idx_property_tokens_is_active 
ON property_tokens(is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_tokens_property_name 
ON property_tokens(property_id, name);

-- ============================================================================
-- ADD PROPERTY_TOKEN_ID TO INVESTMENTS TABLE
-- ============================================================================

ALTER TABLE investments 
ADD COLUMN IF NOT EXISTS property_token_id UUID;

CREATE INDEX IF NOT EXISTS idx_investments_property_token_id 
ON investments(property_token_id);

-- Add foreign key constraint (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_investments_property_token'
  ) THEN
    ALTER TABLE investments
    ADD CONSTRAINT fk_investments_property_token
    FOREIGN KEY (property_token_id) REFERENCES property_tokens(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- ADD PROPERTY_TOKEN_ID TO REWARDS TABLE
-- ============================================================================

ALTER TABLE rewards 
ADD COLUMN IF NOT EXISTS property_token_id UUID;

CREATE INDEX IF NOT EXISTS idx_rewards_property_token_id 
ON rewards(property_token_id);

-- Add foreign key constraint (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_rewards_property_token'
  ) THEN
    ALTER TABLE rewards
    ADD CONSTRAINT fk_rewards_property_token
    FOREIGN KEY (property_token_id) REFERENCES property_tokens(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- CREATE SEQUENCE FOR DISPLAY CODE (if needed)
-- ============================================================================

-- Note: Display codes are token symbols (MBT, MGT, etc.) which are manually set
-- No sequence needed as they are globally unique token symbols

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE property_tokens IS 'Token tiers for properties - each property can have multiple token types (Bronze, Gold, Platinum, etc.) with different prices and ROI';
COMMENT ON COLUMN property_tokens.display_code IS 'Token symbol (e.g., MBT, MGT, MPT) - globally unique identifier';
COMMENT ON COLUMN property_tokens.property_id IS 'Property this token belongs to';
COMMENT ON COLUMN property_tokens.name IS 'Token name (e.g., Bronze Token, Gold Token)';
COMMENT ON COLUMN property_tokens.color IS 'Hex color code for UI display (e.g., #CD7F32)';
COMMENT ON COLUMN property_tokens.token_symbol IS 'Token symbol abbreviation (e.g., MBT, MGT, MPT)';
COMMENT ON COLUMN property_tokens.price_per_token_usdt IS 'Price per token in USDT';
COMMENT ON COLUMN property_tokens.total_tokens IS 'Total supply of tokens for this tier';
COMMENT ON COLUMN property_tokens.available_tokens IS 'Available tokens for purchase';
COMMENT ON COLUMN property_tokens.expected_roi IS 'Expected ROI percentage for this token tier';
COMMENT ON COLUMN property_tokens.apartment_type IS 'Apartment type (e.g., Studio, 1BR, 2BR, Penthouse)';
COMMENT ON COLUMN property_tokens.apartment_features IS 'Apartment features stored as JSONB (bedrooms, bathrooms, area, amenities)';
COMMENT ON COLUMN property_tokens.display_order IS 'Order for displaying tokens in UI';
COMMENT ON COLUMN property_tokens.is_active IS 'Whether this token tier is active and available for investment';

COMMENT ON COLUMN investments.property_token_id IS 'Reference to specific token tier (nullable for backward compatibility)';
COMMENT ON COLUMN rewards.property_token_id IS 'Reference to specific token tier for ROI distribution (nullable for backward compatibility)';

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- Query tokens for a property:
--   SELECT * FROM property_tokens 
--   WHERE property_id = 'uuid' 
--   AND is_active = true
--   ORDER BY display_order ASC;
--
-- Query investments for a specific token:
--   SELECT * FROM investments 
--   WHERE property_token_id = 'token-uuid';
--
-- Query ROI rewards for a specific token:
--   SELECT * FROM rewards 
--   WHERE property_token_id = 'token-uuid' 
--   AND type = 'roi';
--
