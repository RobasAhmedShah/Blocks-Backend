# Database Migrations

This directory contains SQL migration files for the Blocks Backend database.

## 🚨 CRITICAL: Production Missing Columns Fix

**If you're seeing errors like:**
- `column User.dob does not exist`
- `column User.password does not exist`
- `column User.expoToken does not exist`
- `column property.documents does not exist`

**This means your production database is missing columns that exist in TypeORM entities.**

### Solution: Run the Comprehensive Fix Migration

**File:** `fix-missing-columns-production.sql`

This migration adds ALL missing columns that should exist based on your entity definitions:

1. **Connect to your production database** (Neon/Vercel)
2. **Open SQL Editor** in Neon dashboard
3. **Copy and paste** the contents of `fix-missing-columns-production.sql`
4. **Execute** the migration
5. **Verify** columns exist (see verification queries in the migration file)

**Why this happened:**
- TypeORM `synchronize` was used in development (auto-creates columns)
- Production has `synchronize=false` (correct, but migrations weren't run)
- Result: Columns exist in entities but not in production database

**See:** `docs/PRODUCTION_MIGRATION_GUIDE.md` for detailed explanation and best practices.

---

## Quick Fix for Password Column Issue

If you're experiencing issues where the `password` column is missing or going null:

### Option 1: Run the Quick Fix SQL (Recommended)

1. Connect to your Neon database using their SQL Editor or psql
2. Run the `fix-password-column.sql` file:
   ```sql
   -- Copy and paste the contents of fix-password-column.sql
   ```

### Option 2: Use the Migration Script

```bash
# Make sure DATABASE_URL is set in your .env file
npm run migrate
```

### Option 3: Manual SQL

Run this directly in your Neon SQL Editor:

```sql
-- Add password column if missing
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password VARCHAR(255) NULL;

-- Create email index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

## Migration Files

- **`fix-missing-columns-production.sql`** - ⚠️ **CRITICAL**: Fixes all missing columns in production (run this first!)
- `add-password-to-users.sql` - Adds password column for JWT authentication
- `add-user-profile-fields.sql` - Adds profile fields (dob, address, profileImage)
- `add-push-notifications.sql` - Adds expoToken and webPushSubscription columns
- `add-property-documents-column.sql` - Adds documents JSONB column to properties
- `fix-password-column.sql` - Quick fix for password column issues

## Running Migrations

### Using the Script

```bash
npm run migrate
```

### Manual Execution

1. Connect to your Neon database
2. Open the SQL Editor in Neon dashboard
3. Copy and paste the contents of the migration file
4. Execute the SQL

## Important Notes

- **Never use `synchronize: true` in production** - It's disabled in production by default now
- Always backup your database before running migrations
- Migrations are idempotent (safe to run multiple times)
- The password column is nullable to support existing users

## Troubleshooting

### Password Column Missing

If the password column doesn't exist:
1. Check if it exists with different casing: `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND LOWER(column_name) = 'password';`
2. Run `fix-password-column.sql` to create/fix it

### Column Name Case Issues

PostgreSQL is case-sensitive for quoted identifiers. If TypeORM created a column with quotes (e.g., `"Password"`), you need to rename it:
```sql
ALTER TABLE users RENAME COLUMN "Password" TO password;
```

### Synchronize Issues

If `synchronize: true` was enabled in production, it might have created columns with wrong names or types. Disable it and use migrations instead.

