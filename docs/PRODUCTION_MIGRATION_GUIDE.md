# Production Migration Guide

## 🚨 Critical Issue: Missing Columns in Production

### Problem Description

When `ENABLE_SYNC=false` in production (Vercel), database columns defined in TypeORM entities are missing, causing errors like:
- `column User.dob does not exist`
- `column User.password does not exist`
- `column User.expoToken does not exist`
- `column property.documents does not exist`

### Root Cause

**What You Were Doing Wrong:**

1. **Relying on TypeORM Synchronize in Development**
   - When `ENABLE_SYNC=true` locally, TypeORM automatically creates/updates database schema based on entity definitions
   - This makes columns appear automatically without running migrations

2. **Not Running Migrations in Production**
   - Production has `ENABLE_SYNC=false` (correct for safety)
   - But migrations were never run in production
   - So columns that exist in entities don't exist in the production database

3. **Schema Drift Between Local and Production**
   - Local database: Has columns (via synchronize)
   - Production database: Missing columns (no migrations run)
   - When you enable sync locally, columns reappear
   - When you disable sync and deploy, production still lacks columns

### Why This Happens

```typescript
// ormconfig.ts
synchronize: process.env.NODE_ENV !== 'production' || process.env.ENABLE_SYNC === 'true'
```

- **Local Development**: `NODE_ENV !== 'production'` → `synchronize: true` → TypeORM auto-creates columns
- **Production (Vercel)**: `NODE_ENV === 'production'` → `synchronize: false` → No auto-creation
- **Result**: Columns only exist where synchronize ran

### Solution

#### Step 1: Run the Fix Migration in Production

Run this migration on your production database (Neon/Vercel):

```sql
-- File: database/migrations/fix-missing-columns-production.sql
-- Run this SQL directly in your Neon dashboard or via psql
```

**How to Run:**

1. **Via Neon Dashboard:**
   - Go to your Neon project dashboard
   - Open SQL Editor
   - Copy and paste the contents of `fix-missing-columns-production.sql`
   - Execute the migration

2. **Via psql (if you have direct access):**
   ```bash
   psql $DATABASE_URL -f database/migrations/fix-missing-columns-production.sql
   ```

3. **Via Vercel (if using Neon integration):**
   - Use Neon's SQL Editor in the Vercel dashboard
   - Or connect directly to Neon and run the migration

#### Step 2: Verify Migration Success

After running the migration, verify columns exist:

```sql
-- Check users table columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('password', 'dob', 'address', 'profileImage', 'expoToken', 'webPushSubscription')
ORDER BY column_name;

-- Check properties table columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'properties' 
AND column_name = 'documents';
```

#### Step 3: Test Production API

After migration, test your production endpoints:
- `/api/mobile/payment-methods` (should not error on `User.dob`)
- `/api/mobile/properties` (should not error on `property.documents`)
- Any endpoint that queries users (should not error on `User.expoToken`)

### Best Practices Going Forward

#### ✅ DO:

1. **Always Use Migrations for Schema Changes**
   - When adding a new column to an entity, create a migration
   - Never rely on `synchronize` to create production schema

2. **Test Migrations Locally First**
   ```bash
   # Test migration on local database
   psql $LOCAL_DATABASE_URL -f database/migrations/your-migration.sql
   ```

3. **Run Migrations in Production Before Deploying Code**
   - Deploy migration → Wait for completion → Deploy code
   - This prevents "column does not exist" errors

4. **Keep `ENABLE_SYNC=false` in Production**
   - This is correct and safe
   - Prevents accidental schema changes

#### ❌ DON'T:

1. **Don't Enable Synchronize in Production**
   - `ENABLE_SYNC=true` in production is dangerous
   - Can cause data loss or unexpected schema changes

2. **Don't Rely on Synchronize for Schema Changes**
   - Even in development, prefer migrations
   - Synchronize should only be for rapid prototyping

3. **Don't Deploy Code Before Running Migrations**
   - Code expects columns → Columns don't exist → Errors
   - Always: Migration first, then code

### Migration Workflow

#### For New Column Additions:

1. **Update Entity:**
   ```typescript
   // user.entity.ts
   @Column({ type: 'date', nullable: true })
   newField?: Date | null;
   ```

2. **Create Migration:**
   ```sql
   -- database/migrations/add-new-field-to-users.sql
   ALTER TABLE users
   ADD COLUMN IF NOT EXISTS "newField" DATE NULL;
   ```

3. **Test Locally:**
   ```bash
   # Run migration on local DB
   psql $LOCAL_DATABASE_URL -f database/migrations/add-new-field-to-users.sql
   ```

4. **Run in Production:**
   ```bash
   # Run migration on production DB (via Neon dashboard or psql)
   psql $PRODUCTION_DATABASE_URL -f database/migrations/add-new-field-to-users.sql
   ```

5. **Deploy Code:**
   ```bash
   # Now deploy your code that uses the new column
   git push origin main
   ```

### Current Status

**Missing Columns (Fixed by `fix-missing-columns-production.sql`):**

- ✅ `users.password` - Password hash (nullable, select: false)
- ✅ `users.dob` - Date of birth
- ✅ `users.address` - User address
- ✅ `users.profileImage` - Profile image URL
- ✅ `users.expoToken` - Expo push token
- ✅ `users.webPushSubscription` - Web push subscription
- ✅ `properties.documents` - Property documents JSONB

### Verification Checklist

After running the migration, verify:

- [ ] All columns exist in production database
- [ ] No more "column does not exist" errors in Vercel logs
- [ ] API endpoints return data successfully
- [ ] User queries work (JWT strategy, profile endpoints)
- [ ] Property queries work (properties list, details)

### Emergency Rollback

If migration causes issues, you can rollback by dropping columns:

```sql
-- ⚠️ ONLY IF ABSOLUTELY NECESSARY - This will delete data!
ALTER TABLE users DROP COLUMN IF EXISTS password;
ALTER TABLE users DROP COLUMN IF EXISTS "dob";
-- ... etc
```

**Better approach:** Fix the migration and re-run, or restore from backup.

---

## Summary

**The Problem:** Columns defined in TypeORM entities don't exist in production because migrations weren't run.

**The Solution:** Run `fix-missing-columns-production.sql` migration in production database.

**Prevention:** Always create and run migrations for schema changes, never rely on synchronize in production.











