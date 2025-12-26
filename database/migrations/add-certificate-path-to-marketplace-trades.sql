-- Add certificate_path column to marketplace_trades table
-- This stores the path/URL to the transfer certificate PDF for marketplace trades

ALTER TABLE marketplace_trades
ADD COLUMN IF NOT EXISTS certificate_path TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_certificate_path 
ON marketplace_trades(certificate_path) 
WHERE certificate_path IS NOT NULL;

-- Add comment
COMMENT ON COLUMN marketplace_trades.certificate_path IS 'Path/URL to the transfer certificate PDF stored in Supabase Marketplace bucket';

