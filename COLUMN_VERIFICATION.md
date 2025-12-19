# Bank Transfer Requests - Column Verification

## Database Schema (from SQL migration)
1. `id` - UUID PRIMARY KEY
2. `display_code` - VARCHAR(32) UNIQUE NOT NULL
3. `user_id` - UUID NOT NULL
4. `amount_usdt` - NUMERIC(18, 6) NOT NULL
5. `currency` - VARCHAR(10) NOT NULL DEFAULT 'USDT'
6. `bank_account_name` - VARCHAR(255) NOT NULL
7. `bank_account_number` - VARCHAR(100) NOT NULL
8. `bank_iban` - VARCHAR(100) NULLABLE
9. `bank_name` - VARCHAR(255) NOT NULL
10. `bank_swift_code` - VARCHAR(20) NULLABLE
11. `bank_branch` - VARCHAR(255) NULLABLE
12. `proof_image_url` - TEXT NULLABLE
13. `status` - VARCHAR(32) NOT NULL DEFAULT 'pending'
14. `reviewed_by` - UUID NULLABLE
15. `reviewed_at` - TIMESTAMPTZ NULLABLE
16. `rejection_reason` - TEXT NULLABLE
17. `transaction_id` - UUID NULLABLE
18. `metadata` - JSONB NULLABLE
19. `description` - TEXT NULLABLE
20. `created_at` - TIMESTAMPTZ NOT NULL DEFAULT NOW()
21. `updated_at` - TIMESTAMPTZ NOT NULL DEFAULT NOW()

## Entity Mapping (TypeORM)
✅ All columns mapped with explicit `name` property:
- `id` → `@PrimaryGeneratedColumn('uuid')`
- `displayCode` → `display_code`
- `userId` → `user_id`
- `amountUSDT` → `amount_usdt`
- `currency` → `currency`
- `bankAccountName` → `bank_account_name`
- `bankAccountNumber` → `bank_account_number`
- `bankIban` → `bank_iban`
- `bankName` → `bank_name`
- `bankSwiftCode` → `bank_swift_code`
- `bankBranch` → `bank_branch`
- `proofImageUrl` → `proof_image_url`
- `status` → `status`
- `reviewedBy` → `reviewed_by`
- `reviewedAt` → `reviewed_at`
- `rejectionReason` → `rejection_reason`
- `transactionId` → `transaction_id`
- `metadata` → `metadata`
- `description` → `description`
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`

## Status: ✅ ALL COLUMNS MATCH
