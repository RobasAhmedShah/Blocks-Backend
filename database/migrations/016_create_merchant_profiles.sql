-- Migration: Create Merchant Profiles table for 1LINK P2M Merchant Profile management
-- Date: 2025-01-12

-- Create merchant profiles table
CREATE TABLE IF NOT EXISTS merchant_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(35) NOT NULL UNIQUE,
    dba_name VARCHAR(140) NOT NULL,
    merchant_name VARCHAR(140) NOT NULL,
    iban VARCHAR(24) NOT NULL,
    bank_bic VARCHAR(6) NOT NULL,
    merchant_category_code VARCHAR(35) NOT NULL,
    account_title VARCHAR(140) NOT NULL,
    merchant_status VARCHAR(2) DEFAULT '00',
    town_name VARCHAR(35),
    address_line VARCHAR(70),
    phone_no VARCHAR(20),
    mobile_no VARCHAR(20),
    email VARCHAR(100),
    dept VARCHAR(70),
    website VARCHAR(128),
    fee_type VARCHAR(1),
    fee_value NUMERIC(10, 2),
    reason_code TEXT,
    last_request_payload JSONB,
    last_response_payload JSONB,
    last_response_code VARCHAR(10),
    last_response_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_merchant_id ON merchant_profiles(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_merchant_status ON merchant_profiles(merchant_status);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_iban ON merchant_profiles(iban);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_created_at ON merchant_profiles(created_at);

-- Add comments for documentation
COMMENT ON TABLE merchant_profiles IS '1LINK P2M Merchant Profile - stores merchant profile information for P2M QR code generation';
COMMENT ON COLUMN merchant_profiles.merchant_id IS 'Unique merchant identifier (max 35 chars)';
COMMENT ON COLUMN merchant_profiles.merchant_status IS 'Merchant status: 00=Active, 01=Inactive, 02=Blocked';
COMMENT ON COLUMN merchant_profiles.fee_type IS 'Fee type: F=Fixed, P=Percentage';
COMMENT ON COLUMN merchant_profiles.iban IS 'Merchant IBAN (24 characters, starts with PK)';
COMMENT ON COLUMN merchant_profiles.bank_bic IS 'Bank BIC code (6 characters)';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_merchant_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_merchant_profiles_updated_at ON merchant_profiles;
CREATE TRIGGER trigger_merchant_profiles_updated_at
    BEFORE UPDATE ON merchant_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_profiles_updated_at();

-- Insert migration record
INSERT INTO migrations (name, executed_at)
VALUES ('016_create_merchant_profiles', NOW())
ON CONFLICT (name) DO NOTHING;


