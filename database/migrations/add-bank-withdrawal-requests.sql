-- Migration: Create bank_withdrawal_requests table
-- Description: Stores withdrawal requests where users request to withdraw funds to their bank accounts
-- Admin manually transfers money and provides transaction ID as proof

-- Create the table
CREATE TABLE IF NOT EXISTS bank_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Display code for easy reference (e.g., "BWR-000001", "BWR-000002")
  -- Format: BWR-XXXXXX (6 digits) - matches BTR- format for deposits, won't conflict with TXN-
  display_code VARCHAR(32) UNIQUE NOT NULL,
  
  -- User who is requesting withdrawal
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Withdrawal amount
  amount_usdt NUMERIC(18, 6) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USDT' NOT NULL,
  
  -- User's Bank Account Details (where they want to receive money)
  user_bank_account_name VARCHAR(255) NOT NULL,
  user_bank_account_number VARCHAR(100) NOT NULL,
  user_bank_iban VARCHAR(100),
  user_bank_name VARCHAR(255) NOT NULL,
  user_bank_swift_code VARCHAR(20),
  user_bank_branch VARCHAR(255),
  
  -- Status
  status VARCHAR(32) DEFAULT 'pending' NOT NULL,
  -- Possible values: 'pending', 'completed', 'rejected'
  
  -- Admin Review
  reviewed_by UUID, -- ID from blocks_admins table (not users table)
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Bank Transaction Proof (provided by admin after manual transfer)
  bank_transaction_id VARCHAR(255), -- Admin enters this from their bank app
  bank_transaction_proof_url TEXT, -- Optional: Admin can upload screenshot
  
  -- Link to wallet transaction (debit transaction)
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB,
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create sequence for display codes (BWR-000001, BWR-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS bank_withdrawal_display_seq START 1;

COMMENT ON SEQUENCE bank_withdrawal_display_seq IS 'Sequence for generating bank withdrawal request display codes (BWR-XXXXXX)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_withdrawal_user_id ON bank_withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_withdrawal_status ON bank_withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_bank_withdrawal_reviewed_by ON bank_withdrawal_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_bank_withdrawal_transaction_id ON bank_withdrawal_requests(transaction_id);

-- Add comments
COMMENT ON TABLE bank_withdrawal_requests IS 'Stores user withdrawal requests to bank accounts';
COMMENT ON COLUMN bank_withdrawal_requests.display_code IS 'Unique display code (BWR-XXXXXX) - 6 digits, matches BTR- format, no conflict with TXN-';
COMMENT ON COLUMN bank_withdrawal_requests.user_bank_account_name IS 'Name on user bank account';
COMMENT ON COLUMN bank_withdrawal_requests.user_bank_account_number IS 'User bank account number';
COMMENT ON COLUMN bank_withdrawal_requests.user_bank_iban IS 'User bank IBAN (optional)';
COMMENT ON COLUMN bank_withdrawal_requests.bank_transaction_id IS 'Transaction ID provided by admin from bank app';
COMMENT ON COLUMN bank_withdrawal_requests.status IS 'pending: awaiting admin transfer, completed: money sent & wallet debited, rejected: request denied';


