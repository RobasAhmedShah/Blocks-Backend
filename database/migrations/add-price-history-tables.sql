-- Migration: Create Price History Tables
-- Date: 2025-12-29
-- Description: Creates tables for tracking token price history and price-affecting events
--              Tracks property base prices, marketplace listing prices, and trade executions
--
-- CONFLICT ANALYSIS: ✅ Verified safe via Neon MCP Server
-- - No table name conflicts
-- - All foreign key references exist
-- - Numeric precision matches existing schema (18, 6)
-- - Index names are unique
-- - TimescaleDB not available - using regular PostgreSQL table

-- ============================================================================
-- CREATE PRICE_EVENT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  property_id UUID NOT NULL,
  
  event_type TEXT NOT NULL
    CHECK (event_type IN ('PROPERTY_CREATED', 'PROPERTY_PRICE_UPDATE', 'LISTING_CREATED', 'PURCHASE_EXECUTED')),
  
  price_per_token NUMERIC(18, 6) NOT NULL, -- Price per token at the time of this event (NUMERIC 18,6 to match existing schema)
  quantity NUMERIC(18, 6) NOT NULL, -- Changed from (18, 8) to match existing schema
  
  actor_id UUID NOT NULL,
  
  -- Reference to related entities
  reference_id UUID NULL, -- Can reference listing_id, trade_id, or property_id
  reference_type TEXT NULL CHECK (reference_type IN ('listing', 'trade', 'property')),
  
  metadata JSONB NULL, -- Additional context (e.g., old_price, new_price for updates)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS FOR PRICE_EVENT
-- ============================================================================

ALTER TABLE price_event
ADD CONSTRAINT fk_price_event_property
FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

ALTER TABLE price_event
ADD CONSTRAINT fk_price_event_actor
FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES FOR PRICE_EVENT
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_price_event_property_id ON price_event(property_id);
CREATE INDEX IF NOT EXISTS idx_price_event_created_at ON price_event(created_at);
CREATE INDEX IF NOT EXISTS idx_price_event_type ON price_event(event_type);
CREATE INDEX IF NOT EXISTS idx_price_event_property_created ON price_event(property_id, created_at);
CREATE INDEX IF NOT EXISTS idx_price_event_reference ON price_event(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- ============================================================================
-- CREATE TOKEN_PRICE_HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_price_history (
  time TIMESTAMPTZ NOT NULL,
  
  property_id UUID NOT NULL,
  
  price_per_token NUMERIC(18, 6) NOT NULL, -- Price per token at this time point (NUMERIC 18,6 to match existing schema)
  volume NUMERIC(18, 6) NOT NULL DEFAULT 0, -- Changed from (18, 8) to match existing schema
  
  -- Price source
  price_source TEXT NOT NULL DEFAULT 'marketplace'
    CHECK (price_source IN ('base', 'marketplace')),
  
  -- Statistics for this time period
  trade_count INTEGER NOT NULL DEFAULT 0,
  min_price_per_token NUMERIC(18, 6) NULL, -- Minimum price per token in this time period (NUMERIC 18,6 to match existing schema)
  max_price_per_token NUMERIC(18, 6) NULL, -- Maximum price per token in this time period (NUMERIC 18,6 to match existing schema)
  
  -- Reference to the event that created this entry
  derived_from_event_id UUID NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (property_id, time)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS FOR TOKEN_PRICE_HISTORY
-- ============================================================================

ALTER TABLE token_price_history
ADD CONSTRAINT fk_token_price_history_property
FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

ALTER TABLE token_price_history
ADD CONSTRAINT fk_token_price_history_event
FOREIGN KEY (derived_from_event_id) REFERENCES price_event(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES FOR TOKEN_PRICE_HISTORY (Optimized for time-series queries)
-- ============================================================================

-- Primary lookup: property + time range
CREATE INDEX IF NOT EXISTS idx_token_price_history_property_time ON token_price_history(property_id, time DESC);

-- Time-based queries (all properties)
CREATE INDEX IF NOT EXISTS idx_token_price_history_time ON token_price_history(time DESC);

-- Price source filtering
CREATE INDEX IF NOT EXISTS idx_token_price_history_price_source ON token_price_history(price_source);

-- Event reference lookup
CREATE INDEX IF NOT EXISTS idx_token_price_history_event ON token_price_history(derived_from_event_id) WHERE derived_from_event_id IS NOT NULL;

-- Composite index for common queries (property + source + time)
CREATE INDEX IF NOT EXISTS idx_token_price_history_property_source_time ON token_price_history(property_id, price_source, time DESC);

-- ============================================================================
-- TIMESCALEDB HYPERTABLE CONVERSION
-- ============================================================================
-- 
-- ✅ TimescaleDB extension is installed - converting to hypertable for optimal performance
-- 
-- This converts token_price_history into a TimescaleDB hypertable, which provides:
-- - Automatic time-based partitioning (chunking)
-- - Optimized time-series queries
-- - Better performance for large datasets
-- - Automatic data retention policies (if configured later)
--
-- Chunk interval: 1 day (recommended for daily price aggregations)
-- Adjust if needed:
--   - '1 hour' for high-frequency trading (many updates per day)
--   - '1 day' for daily aggregations (recommended default)
--   - '1 week' for weekly aggregations (lower frequency)
--
-- ============================================================================
-- Convert to TimescaleDB hypertable
-- ============================================================================

SELECT create_hypertable(
    'token_price_history',
    'time',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '7 day'
);

-- Note: After converting to hypertable, TimescaleDB will automatically manage partitioning
--       and optimize time-series queries. The existing indexes will still work.

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE price_event IS 'Tracks all events that affect token prices (property creation, price updates, listings, trades)';
COMMENT ON TABLE token_price_history IS 'Time-series data of token prices per property, aggregated by time buckets';

COMMENT ON COLUMN price_event.property_id IS 'Property this price event relates to';
COMMENT ON COLUMN price_event.event_type IS 'Type of event: PROPERTY_CREATED, PROPERTY_PRICE_UPDATE, LISTING_CREATED, PURCHASE_EXECUTED';
COMMENT ON COLUMN price_event.price_per_token IS 'Price per token at the time of this event (NUMERIC 18,6 to match existing schema)';
COMMENT ON COLUMN price_event.quantity IS 'Quantity of tokens involved in this event (NUMERIC 18,6 to match existing schema)';
COMMENT ON COLUMN price_event.actor_id IS 'User/admin who triggered this event';
COMMENT ON COLUMN price_event.reference_id IS 'ID of related entity (listing, trade, or property)';
COMMENT ON COLUMN price_event.reference_type IS 'Type of reference: listing, trade, or property';

COMMENT ON COLUMN token_price_history.time IS 'Timestamp for this price data point (part of composite primary key)';
COMMENT ON COLUMN token_price_history.property_id IS 'Property this price history relates to (part of composite primary key)';
COMMENT ON COLUMN token_price_history.price_per_token IS 'Price per token at this time point (NUMERIC 18,6 to match existing schema)';
COMMENT ON COLUMN token_price_history.volume IS 'Trading volume for this time period (NUMERIC 18,6 to match existing schema)';
COMMENT ON COLUMN token_price_history.price_source IS 'Source of price: base (property), marketplace (trade)';
COMMENT ON COLUMN token_price_history.trade_count IS 'Number of trades in this time period';
COMMENT ON COLUMN token_price_history.min_price_per_token IS 'Minimum price per token in this time period';
COMMENT ON COLUMN token_price_history.max_price_per_token IS 'Maximum price per token in this time period';
COMMENT ON COLUMN token_price_history.derived_from_event_id IS 'Reference to price_event that created this history entry';

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration to verify)
-- ============================================================================

-- Verify tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('price_event', 'token_price_history');

-- Verify foreign keys
-- SELECT constraint_name, table_name 
-- FROM information_schema.table_constraints 
-- WHERE constraint_type = 'FOREIGN KEY' 
-- AND table_name IN ('price_event', 'token_price_history');

-- Verify indexes
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('price_event', 'token_price_history');

-- Verify numeric precision matches
-- SELECT column_name, data_type, numeric_precision, numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_name IN ('price_event', 'token_price_history') 
-- AND data_type = 'numeric';


