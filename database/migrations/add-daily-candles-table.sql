-- Migration: Create Daily Candles Aggregate Table
-- Date: 2025-12-29
-- Description: Creates a regular PostgreSQL table for 1-day OHLC candles
--              Aggregated from token_price_history via NestJS cron job (every 15 minutes)
--              No TimescaleDB required - works with standard PostgreSQL
--
-- ============================================================================
-- CREATE DAILY CANDLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_candles_1d (
  bucket_day TIMESTAMPTZ NOT NULL,
  property_id UUID NOT NULL,
  price_source TEXT NOT NULL DEFAULT 'marketplace',
  
  -- OHLC (Open, High, Low, Close)
  open_price NUMERIC(18, 6) NOT NULL,
  high_price NUMERIC(18, 6) NOT NULL,
  low_price NUMERIC(18, 6) NOT NULL,
  close_price NUMERIC(18, 6) NOT NULL,
  
  -- Volume and trade statistics
  volume NUMERIC(18, 6) NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  PRIMARY KEY (bucket_day, property_id, price_source),
  CHECK (price_source IN ('base', 'marketplace'))
);

-- ============================================================================
-- INDEXES FOR EFFICIENT QUERYING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_daily_candles_1d_property_bucket_day 
ON daily_candles_1d(property_id, bucket_day DESC);

CREATE INDEX IF NOT EXISTS idx_daily_candles_1d_bucket_day 
ON daily_candles_1d(bucket_day DESC);

CREATE INDEX IF NOT EXISTS idx_daily_candles_1d_price_source 
ON daily_candles_1d(price_source);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add foreign key to properties table
ALTER TABLE daily_candles_1d
ADD CONSTRAINT fk_daily_candles_property
FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE daily_candles_1d IS 'Daily OHLC candles (1-day buckets) - aggregated from token_price_history via NestJS cron job every 15 minutes';
COMMENT ON COLUMN daily_candles_1d.bucket_day IS 'Date bucket (start of day in UTC as TIMESTAMPTZ)';
COMMENT ON COLUMN daily_candles_1d.property_id IS 'Property this candle represents';
COMMENT ON COLUMN daily_candles_1d.price_source IS 'Source of price (base or marketplace)';
COMMENT ON COLUMN daily_candles_1d.open_price IS 'Opening price (first trade of the day)';
COMMENT ON COLUMN daily_candles_1d.high_price IS 'Highest price during the day';
COMMENT ON COLUMN daily_candles_1d.low_price IS 'Lowest price during the day';
COMMENT ON COLUMN daily_candles_1d.close_price IS 'Closing price (last trade of the day)';
COMMENT ON COLUMN daily_candles_1d.volume IS 'Total volume (tokens traded) for the day';
COMMENT ON COLUMN daily_candles_1d.trade_count IS 'Total number of trades for the day';
COMMENT ON COLUMN daily_candles_1d.created_at IS 'When this candle record was first created';
COMMENT ON COLUMN daily_candles_1d.updated_at IS 'When this candle record was last updated';

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- Query the table:
--   SELECT * FROM daily_candles_1d 
--   WHERE property_id = 'uuid' 
--   AND bucket_day >= '2025-01-01T00:00:00Z'
--   ORDER BY bucket_day ASC;
--
-- The table is automatically populated/updated by NestJS cron job every 15 minutes
-- See: TokenPriceHistoryService.aggregateDailyCandles()
--


