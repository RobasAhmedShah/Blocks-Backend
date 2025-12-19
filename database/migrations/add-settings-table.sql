-- Migration: Add Settings Table
-- Date: 2025-12-15
-- Description: Creates settings table for storing configurable system settings (bank account details, etc.)

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Setting key (unique identifier)
  key VARCHAR(100) UNIQUE NOT NULL,
  
  -- Setting value (stored as text to support any type)
  value TEXT NOT NULL,
  
  -- Optional description
  description VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Comments
COMMENT ON TABLE settings IS 'System settings and configuration values';
COMMENT ON COLUMN settings.key IS 'Unique setting identifier (e.g., BANK_ACCOUNT_NAME)';
COMMENT ON COLUMN settings.value IS 'Setting value (stored as text)';
COMMENT ON COLUMN settings.description IS 'Human-readable description of the setting';

-- Insert default bank account settings (if not exists)
INSERT INTO settings (key, value, description)
VALUES 
  ('BANK_ACCOUNT_NAME', 'Blocks Investment Platform', 'Bank account name for deposits'),
  ('BANK_ACCOUNT_NUMBER', 'PK12BLOCKS0001234567890', 'Bank account number for deposits'),
  ('BANK_IBAN', 'PK12BLOCKS0001234567890', 'Bank IBAN for deposits'),
  ('BANK_NAME', 'Standard Chartered Bank', 'Bank name for deposits'),
  ('BANK_SWIFT_CODE', 'SCBLPKKA', 'Bank SWIFT code for deposits'),
  ('BANK_BRANCH', 'Main Branch, Karachi', 'Bank branch for deposits')
ON CONFLICT (key) DO NOTHING;
