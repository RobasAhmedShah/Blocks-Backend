-- Create linked_bank_accounts table
CREATE TABLE IF NOT EXISTS linked_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  iban VARCHAR(100),
  bank_name VARCHAR(255) NOT NULL,
  swift_code VARCHAR(20),
  branch VARCHAR(255),
  account_type VARCHAR(50),
  status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'disabled')),
  is_default BOOLEAN DEFAULT false,
  display_name VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_linked_bank_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_linked_bank_accounts_user_id ON linked_bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_bank_accounts_status ON linked_bank_accounts(status);
CREATE INDEX IF NOT EXISTS idx_linked_bank_accounts_is_default ON linked_bank_accounts(is_default);

-- Create unique constraint: only one default account per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_bank_accounts_user_default 
ON linked_bank_accounts(user_id) 
WHERE is_default = true AND status = 'verified';
