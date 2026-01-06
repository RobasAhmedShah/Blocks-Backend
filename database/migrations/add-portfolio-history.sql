-- Migration: Create Portfolio History Tables
-- Date: 2025-01-XX
-- Description: Creates tables for event-driven portfolio history tracking
--              portfolio_history: Event-driven snapshots (created on every portfolio change)
--              portfolio_daily_candles: Daily aggregated OHLC data (aggregated every 5 minutes from snapshots)
--              portfolio_history is converted to TimescaleDB hypertable for optimal time-series performance
--
-- ============================================================================
-- CREATE PORTFOLIO HISTORY TABLE (Event-driven snapshots)
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_value NUMERIC(18, 6) NOT NULL,
  total_invested NUMERIC(18, 6),
  recorded_at TIMESTAMPTZ NOT NULL,
  change_type VARCHAR(32),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_portfolio_history_user_recorded 
ON portfolio_history(user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_history_recorded 
ON portfolio_history(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_history_change_type 
ON portfolio_history(change_type);

-- ============================================================================
-- TIMESCALEDB HYPERTABLE CONVERSION
-- ============================================================================
-- 
-- ✅ TimescaleDB extension is installed - converting to hypertable for optimal performance
-- 
-- This converts portfolio_history into a TimescaleDB hypertable, which provides:
-- - Automatic time-based partitioning (chunking)
-- - Optimized time-series queries
-- - Better performance for large datasets
-- - Automatic data retention policies (if configured later)
--
-- Chunk interval: 1 day (recommended for event-driven snapshots with daily aggregation)
-- Adjust if needed:
--   - '1 hour' for very high-frequency updates (many snapshots per hour)
--   - '1 day' for daily aggregations (recommended default)
--   - '7 days' for weekly aggregations (lower frequency)
--
-- ============================================================================
-- Convert to TimescaleDB hypertable
-- ============================================================================

SELECT create_hypertable(
    'portfolio_history',
    'recorded_at',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '1 day'
);

-- Note: After converting to hypertable, TimescaleDB will automatically manage partitioning
--       and optimize time-series queries. The existing indexes will still work.

-- ============================================================================
-- CREATE PORTFOLIO DAILY CANDLES TABLE (Aggregated OHLC)
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_daily_candles (
  bucket_day TIMESTAMPTZ NOT NULL,
  user_id UUID NOT NULL,
  
  -- OHLC (Open, High, Low, Close) values
  open_value NUMERIC(18, 6) NOT NULL,
  high_value NUMERIC(18, 6) NOT NULL,
  low_value NUMERIC(18, 6) NOT NULL,
  close_value NUMERIC(18, 6) NOT NULL,
  
  -- Additional stats
  total_invested NUMERIC(18, 6) NOT NULL,
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  PRIMARY KEY (bucket_day, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_portfolio_daily_candles_user_day 
ON portfolio_daily_candles(user_id, bucket_day DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_daily_candles_day 
ON portfolio_daily_candles(bucket_day DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE portfolio_history IS 'Event-driven portfolio snapshots - created whenever portfolio value changes (investment, reward, marketplace trade, etc.)';
COMMENT ON COLUMN portfolio_history.user_id IS 'User this snapshot belongs to';
COMMENT ON COLUMN portfolio_history.total_value IS 'Total portfolio value at time of snapshot (tokens × price × 1.15)';
COMMENT ON COLUMN portfolio_history.total_invested IS 'Total amount invested at time of snapshot';
COMMENT ON COLUMN portfolio_history.recorded_at IS 'Timestamp when snapshot was recorded';
COMMENT ON COLUMN portfolio_history.change_type IS 'Type of change that triggered snapshot: investment, reward, marketplace_buy, marketplace_sell, price_update, snapshot';
COMMENT ON COLUMN portfolio_history.reference_id IS 'Reference to the entity that caused the change (investmentId, rewardId, tradeId, etc.)';

COMMENT ON TABLE portfolio_daily_candles IS 'Daily aggregated portfolio OHLC candles - computed from portfolio_history snapshots via NestJS cron job (every 5 minutes)';
COMMENT ON COLUMN portfolio_daily_candles.bucket_day IS 'Date bucket (start of day in UTC as TIMESTAMPTZ)';
COMMENT ON COLUMN portfolio_daily_candles.user_id IS 'User this candle represents';
COMMENT ON COLUMN portfolio_daily_candles.open_value IS 'Opening portfolio value (first snapshot of the day)';
COMMENT ON COLUMN portfolio_daily_candles.high_value IS 'Highest portfolio value during the day';
COMMENT ON COLUMN portfolio_daily_candles.low_value IS 'Lowest portfolio value during the day';
COMMENT ON COLUMN portfolio_daily_candles.close_value IS 'Closing portfolio value (last snapshot of the day)';
COMMENT ON COLUMN portfolio_daily_candles.total_invested IS 'Total invested amount (from last snapshot of the day)';
COMMENT ON COLUMN portfolio_daily_candles.snapshot_count IS 'Number of snapshots aggregated for this day';

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- Query portfolio history (from daily candles):
--   SELECT * FROM portfolio_daily_candles 
--   WHERE user_id = 'uuid' 
--   AND bucket_day >= '2025-01-01T00:00:00Z'
--   ORDER BY bucket_day ASC;
--
-- Query raw snapshots:
--   SELECT * FROM portfolio_history 
--   WHERE user_id = 'uuid' 
--   AND recorded_at >= '2025-01-01T00:00:00Z'
--   ORDER BY recorded_at ASC;
--
-- The portfolio_daily_candles table is automatically populated/updated by NestJS cron job every 5 minutes
-- See: PortfolioService.aggregateDailyCandles()
--
-- TimescaleDB Hypertable Benefits:
-- - Automatic time-based partitioning improves query performance
-- - Better index utilization for time-range queries
-- - Supports compression and retention policies for old data
-- - Optimized for time-series aggregation operations
--

