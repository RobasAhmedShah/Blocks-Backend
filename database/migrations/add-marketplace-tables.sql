-- Migration: Create Marketplace Tables
-- Date: 2025-12-23
-- Description: Creates tables for peer-to-peer token marketplace
--              Allows users to buy and sell property tokens from each other

-- ============================================================================
-- CREATE SEQUENCES FOR DISPLAY CODES
-- ============================================================================

-- Marketplace Listing display codes (MKT-000001, MKT-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS marketplace_listing_display_seq START 1;
COMMENT ON SEQUENCE marketplace_listing_display_seq IS 'Sequence for generating marketplace listing display codes (MKT-XXXXXX)';

-- Marketplace Trade display codes (TRD-000001, TRD-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS marketplace_trade_display_seq START 1;
COMMENT ON SEQUENCE marketplace_trade_display_seq IS 'Sequence for generating marketplace trade display codes (TRD-XXXXXX)';

-- ============================================================================
-- CREATE MARKETPLACE_LISTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Display Code (MKT-000001, MKT-000002, etc.)
  display_code VARCHAR(32) UNIQUE NOT NULL,
  
  -- Seller Information (CASCADE DELETE - if user deleted, listings deleted)
  seller_id UUID NOT NULL,
  
  -- Property Information
  property_id UUID NOT NULL,
  
  -- Pricing
  price_per_token NUMERIC(18, 6) NOT NULL CHECK (price_per_token > 0),
  
  -- Token Quantities
  total_tokens NUMERIC(18, 6) NOT NULL CHECK (total_tokens > 0),
  remaining_tokens NUMERIC(18, 6) NOT NULL CHECK (remaining_tokens >= 0),
  
  -- Order Limits (in USDT)
  min_order_usdt NUMERIC(18, 6) NOT NULL CHECK (min_order_usdt > 0),
  max_order_usdt NUMERIC(18, 6) NOT NULL CHECK (max_order_usdt >= min_order_usdt),
  
  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CREATE MARKETPLACE_TRADES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Display Code (TRD-000001, TRD-000002, etc.)
  display_code VARCHAR(32) UNIQUE NOT NULL,
  
  -- Listing Reference (SET NULL if listing deleted - preserve trade history)
  listing_id UUID,
  
  -- Buyer and Seller
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  
  -- Property Information
  property_id UUID NOT NULL,
  
  -- Trade Details
  tokens_bought NUMERIC(18, 6) NOT NULL CHECK (tokens_bought > 0),
  total_usdt NUMERIC(18, 6) NOT NULL CHECK (total_usdt > 0),
  price_per_token NUMERIC(18, 6) NOT NULL CHECK (price_per_token > 0),
  
  -- Transaction References (for buyer and seller wallet transactions)
  buyer_transaction_id UUID,
  seller_transaction_id UUID,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CREATE TOKEN_LOCKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Investment Reference (CASCADE DELETE - if investment deleted, lock removed)
  investment_id UUID NOT NULL,
  
  -- Listing Reference (CASCADE DELETE - if listing deleted/cancelled, locks removed)
  listing_id UUID NOT NULL,
  
  -- Locked Token Amount
  locked_tokens NUMERIC(18, 6) NOT NULL CHECK (locked_tokens > 0),
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Marketplace Listings Foreign Keys
ALTER TABLE marketplace_listings
ADD CONSTRAINT fk_marketplace_listings_seller
FOREIGN KEY (seller_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

ALTER TABLE marketplace_listings
ADD CONSTRAINT fk_marketplace_listings_property
FOREIGN KEY (property_id) 
REFERENCES properties(id) 
ON DELETE CASCADE;

-- Marketplace Trades Foreign Keys
ALTER TABLE marketplace_trades
ADD CONSTRAINT fk_marketplace_trades_listing
FOREIGN KEY (listing_id) 
REFERENCES marketplace_listings(id) 
ON DELETE SET NULL;

ALTER TABLE marketplace_trades
ADD CONSTRAINT fk_marketplace_trades_buyer
FOREIGN KEY (buyer_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

ALTER TABLE marketplace_trades
ADD CONSTRAINT fk_marketplace_trades_seller
FOREIGN KEY (seller_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

ALTER TABLE marketplace_trades
ADD CONSTRAINT fk_marketplace_trades_property
FOREIGN KEY (property_id) 
REFERENCES properties(id) 
ON DELETE CASCADE;

ALTER TABLE marketplace_trades
ADD CONSTRAINT fk_marketplace_trades_buyer_transaction
FOREIGN KEY (buyer_transaction_id) 
REFERENCES transactions(id) 
ON DELETE SET NULL;

ALTER TABLE marketplace_trades
ADD CONSTRAINT fk_marketplace_trades_seller_transaction
FOREIGN KEY (seller_transaction_id) 
REFERENCES transactions(id) 
ON DELETE SET NULL;

-- Token Locks Foreign Keys
ALTER TABLE token_locks
ADD CONSTRAINT fk_token_locks_investment
FOREIGN KEY (investment_id) 
REFERENCES investments(id) 
ON DELETE CASCADE;

ALTER TABLE token_locks
ADD CONSTRAINT fk_token_locks_listing
FOREIGN KEY (listing_id) 
REFERENCES marketplace_listings(id) 
ON DELETE CASCADE;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Marketplace Listings Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_id ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_property_id ON marketplace_listings(property_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at ON marketplace_listings(created_at DESC);

-- Marketplace Trades Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_listing_id ON marketplace_trades(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_buyer_id ON marketplace_trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_seller_id ON marketplace_trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_property_id ON marketplace_trades(property_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_created_at ON marketplace_trades(created_at DESC);

-- Token Locks Indexes
CREATE INDEX IF NOT EXISTS idx_token_locks_investment_id ON token_locks(investment_id);
CREATE INDEX IF NOT EXISTS idx_token_locks_listing_id ON token_locks(listing_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_locks_investment_listing ON token_locks(investment_id, listing_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE marketplace_listings IS 'Stores active token listings for peer-to-peer marketplace';
COMMENT ON COLUMN marketplace_listings.display_code IS 'Unique display code (MKT-XXXXXX) - 6 digits';
COMMENT ON COLUMN marketplace_listings.remaining_tokens IS 'Tokens still available for purchase (decreases as tokens are sold)';
COMMENT ON COLUMN marketplace_listings.min_order_usdt IS 'Minimum purchase amount in USDT';
COMMENT ON COLUMN marketplace_listings.max_order_usdt IS 'Maximum purchase amount in USDT';
COMMENT ON COLUMN marketplace_listings.status IS 'active: available for purchase, sold: all tokens sold, cancelled: seller cancelled listing';

COMMENT ON TABLE marketplace_trades IS 'Stores completed token purchases in marketplace';
COMMENT ON COLUMN marketplace_trades.display_code IS 'Unique display code (TRD-XXXXXX) - 6 digits';
COMMENT ON COLUMN marketplace_trades.tokens_bought IS 'Number of tokens purchased in this trade';
COMMENT ON COLUMN marketplace_trades.total_usdt IS 'Total USDT paid by buyer (tokens_bought * price_per_token)';

COMMENT ON TABLE token_locks IS 'Tracks tokens locked in active marketplace listings (prevents double-listing and withdrawal)';
COMMENT ON COLUMN token_locks.locked_tokens IS 'Amount of tokens locked for this listing from this investment';
COMMENT ON COLUMN token_locks.investment_id IS 'Investment record containing the locked tokens';
COMMENT ON COLUMN token_locks.listing_id IS 'Marketplace listing that has locked these tokens';

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_marketplace_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_marketplace_listings_updated_at
BEFORE UPDATE ON marketplace_listings
FOR EACH ROW
EXECUTE FUNCTION update_marketplace_listings_updated_at();

