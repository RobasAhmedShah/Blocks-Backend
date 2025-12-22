-- Migration: Add Bank Transfer Requests Table
-- Date: 2025-12-15
-- Description: Creates bank_transfer_requests table for bank transfer deposit flow with admin approval

-- ============================================================================
-- CREATE SEQUENCE FOR DISPLAY CODES
-- ============================================================================

-- Bank Transfer Request display codes (BTR-000001, BTR-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS bank_transfer_display_seq START 1;

COMMENT ON SEQUENCE bank_transfer_display_seq IS 'Sequence for generating bank transfer request display codes (BTR-XXXXXX)';

-- ============================================================================
-- CREATE BANK TRANSFER REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Display Code (BTR-000001, BTR-000002, etc.)
  display_code VARCHAR(32) UNIQUE NOT NULL,
  
  -- User Information (CASCADE DELETE - if user deleted, requests deleted)
  user_id UUID NOT NULL,
  
  -- Transfer Details
  amount_usdt NUMERIC(18, 6) NOT NULL CHECK (amount_usdt > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USDT',
  
  -- Bank Account Details (where user sent money to)
  bank_account_name VARCHAR(255) NOT NULL,
  bank_account_number VARCHAR(100) NOT NULL,
  bank_iban VARCHAR(100),
  bank_name VARCHAR(255) NOT NULL,
  bank_swift_code VARCHAR(20),
  bank_branch VARCHAR(255),
  
  -- Proof Upload (Supabase storage URL)
  proof_image_url TEXT,
  
  -- Status & Admin Review
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Admin who reviewed (SET NULL if admin deleted - preserve audit)
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Transaction Link (created when approved, SET NULL if transaction deleted)
  transaction_id UUID,
  
  -- Metadata
  metadata JSONB,
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- User relationship (CASCADE DELETE)
ALTER TABLE bank_transfer_requests
ADD CONSTRAINT fk_bank_transfer_requests_user
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Admin reviewer relationship (SET NULL - preserve audit if admin deleted)
ALTER TABLE bank_transfer_requests
ADD CONSTRAINT fk_bank_transfer_requests_reviewer
FOREIGN KEY (reviewed_by) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Transaction relationship (SET NULL - preserve request if transaction deleted)
ALTER TABLE bank_transfer_requests
ADD CONSTRAINT fk_bank_transfer_requests_transaction
FOREIGN KEY (transaction_id) 
REFERENCES transactions(id) 
ON DELETE SET NULL;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on user_id for fast user queries
CREATE INDEX IF NOT EXISTS idx_bank_transfer_requests_user_id 
ON bank_transfer_requests(user_id);

-- Index on status for filtering pending/approved/rejected
CREATE INDEX IF NOT EXISTS idx_bank_transfer_requests_status 
ON bank_transfer_requests(status);

-- Index on created_at for sorting by date
CREATE INDEX IF NOT EXISTS idx_bank_transfer_requests_created_at 
ON bank_transfer_requests(created_at DESC);

-- Index on reviewed_by for admin queries
CREATE INDEX IF NOT EXISTS idx_bank_transfer_requests_reviewed_by 
ON bank_transfer_requests(reviewed_by);

-- Index on transaction_id for linking
CREATE INDEX IF NOT EXISTS idx_bank_transfer_requests_transaction_id 
ON bank_transfer_requests(transaction_id);

-- Composite index for common admin queries (status + created_at)
CREATE INDEX IF NOT EXISTS idx_bank_transfer_requests_status_created 
ON bank_transfer_requests(status, created_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE bank_transfer_requests IS 'Bank transfer deposit requests requiring admin approval';
COMMENT ON COLUMN bank_transfer_requests.display_code IS 'Unique display code (BTR-XXXXXX)';
COMMENT ON COLUMN bank_transfer_requests.user_id IS 'User who initiated the bank transfer';
COMMENT ON COLUMN bank_transfer_requests.amount_usdt IS 'Deposit amount in USDT';
COMMENT ON COLUMN bank_transfer_requests.bank_account_name IS 'Bank account name where user sent money';
COMMENT ON COLUMN bank_transfer_requests.bank_account_number IS 'Bank account number';
COMMENT ON COLUMN bank_transfer_requests.proof_image_url IS 'URL to uploaded receipt/screenshot in Supabase';
COMMENT ON COLUMN bank_transfer_requests.status IS 'Request status: pending, approved, or rejected';
COMMENT ON COLUMN bank_transfer_requests.reviewed_by IS 'Admin user who reviewed the request';
COMMENT ON COLUMN bank_transfer_requests.transaction_id IS 'Transaction created when request is approved';
COMMENT ON COLUMN bank_transfer_requests.metadata IS 'Additional metadata in JSON format';

-- ============================================================================
-- VERIFICATION QUERIES (Optional - run these to verify)
-- ============================================================================

-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'bank_transfer_requests'
);

Check if sequence exists
SELECT EXISTS (
  SELECT FROM pg_sequences 
  WHERE schemaname = 'public' 
  AND sequencename = 'bank_transfer_display_seq'
);

Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'bank_transfer_requests';


