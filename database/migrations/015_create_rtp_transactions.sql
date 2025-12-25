-- Migration: Create RTP Transactions table for 1LINK P2M RTP audit logging
-- Date: 2024-12-25

-- Create RTP transactions table
CREATE TABLE IF NOT EXISTS rtp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_code VARCHAR(50),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    operation_type VARCHAR(50) NOT NULL,
    rtp_id VARCHAR(100),
    stan VARCHAR(6) NOT NULL,
    rrn VARCHAR(12),
    merchant_id VARCHAR(35),
    amount DECIMAL(18, 2),
    currency VARCHAR(3) DEFAULT 'PKR',
    payer_iban VARCHAR(24),
    payer_title VARCHAR(140),
    payer_mobile VARCHAR(30),
    status VARCHAR(20) DEFAULT 'PENDING',
    response_code VARCHAR(10),
    response_description VARCHAR(500),
    request_payload JSONB,
    response_payload JSONB,
    expiry_date_time TIMESTAMP WITH TIME ZONE,
    execution_date_time TIMESTAMP WITH TIME ZONE,
    bill_no VARCHAR(35),
    error_message VARCHAR(500),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rtp_transactions_rtp_id ON rtp_transactions(rtp_id);
CREATE INDEX IF NOT EXISTS idx_rtp_transactions_user_id ON rtp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rtp_transactions_stan ON rtp_transactions(stan);
CREATE INDEX IF NOT EXISTS idx_rtp_transactions_rrn ON rtp_transactions(rrn);
CREATE INDEX IF NOT EXISTS idx_rtp_transactions_status ON rtp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_rtp_transactions_created_at ON rtp_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_rtp_transactions_display_code ON rtp_transactions(display_code);
CREATE INDEX IF NOT EXISTS idx_rtp_transactions_operation_type ON rtp_transactions(operation_type);

-- Add comments for documentation
COMMENT ON TABLE rtp_transactions IS '1LINK P2M RTP transaction audit log - stores all RTP API requests and responses';
COMMENT ON COLUMN rtp_transactions.operation_type IS 'Type of RTP operation: PRE_RTP_TITLE_FETCH, PRE_RTP_ALIAS_INQUIRY, RTP_NOW_MERCHANT, RTP_NOW_AGGREGATOR, RTP_LATER_MERCHANT, RTP_LATER_AGGREGATOR, STATUS_INQUIRY, RTP_CANCELLATION';
COMMENT ON COLUMN rtp_transactions.rtp_id IS 'Unique RTP ID from 1LINK - used to track and reference RTP requests';
COMMENT ON COLUMN rtp_transactions.stan IS 'System Trace Audit Number - 6 digit unique number per request';
COMMENT ON COLUMN rtp_transactions.rrn IS 'Retrieval Reference Number - 12 digit unique number';
COMMENT ON COLUMN rtp_transactions.status IS 'RTP status: PENDING, SENT, ACCEPTED, REJECTED, CANCELLED, EXPIRED, COMPLETED, FAILED';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_rtp_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rtp_transactions_updated_at ON rtp_transactions;
CREATE TRIGGER trigger_rtp_transactions_updated_at
    BEFORE UPDATE ON rtp_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_rtp_transactions_updated_at();

-- Insert migration record
INSERT INTO migrations (name, executed_at)
VALUES ('015_create_rtp_transactions', NOW())
ON CONFLICT (name) DO NOTHING;

