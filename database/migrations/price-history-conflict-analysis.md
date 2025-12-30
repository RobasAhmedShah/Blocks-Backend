# Price History Feature - Database Conflict Analysis

**Date:** 2025-12-29  
**Database:** Blocks (Project ID: `tiny-water-07173886`)  
**PostgreSQL Version:** 17  
**Analysis Method:** Direct Neon MCP Server Query

---

## ✅ EXECUTIVE SUMMARY

**Status: SAFE TO IMPLEMENT** - No conflicts detected. The proposed schema is compatible with the existing database structure.

---

## 1. TABLE NAME CONFLICTS

### Existing Tables Checked:
- ✅ `price_event` - **DOES NOT EXIST** (Safe to create)
- ✅ `token_price_history` - **DOES NOT EXIST** (Safe to create)

**Result:** No table name conflicts.

---

## 2. FOREIGN KEY REFERENCES

### Referenced Tables Status:

| Foreign Key | References | Status | Notes |
|-------------|------------|--------|-------|
| `price_event.property_id` → `properties.id` | ✅ EXISTS | ✅ Safe | `properties` table confirmed with UUID primary key |
| `price_event.actor_id` → `users.id` | ✅ EXISTS | ✅ Safe | `users` table confirmed with UUID primary key |
| `token_price_history.property_id` → `properties.id` | ✅ EXISTS | ✅ Safe | Same as above |
| `token_price_history.derived_from_event_id` → `price_event.id` | ⚠️ Self-ref | ✅ Safe | Will exist after `price_event` is created |

**Result:** All foreign key references are valid.

---

## 3. DATA TYPE COMPATIBILITY

### Numeric Precision Analysis:

**Existing Pattern:**
- `marketplace_trades.price_per_token`: `NUMERIC(18, 6)` ✅
- `marketplace_trades.tokens_bought`: `NUMERIC(18, 6)` ✅
- `marketplace_listings.price_per_token`: `NUMERIC(18, 6)` ✅
- `properties.pricePerTokenUSDT`: `NUMERIC(18, 6)` ✅

**Proposed Schema:**
- `price_event.price`: `NUMERIC(18, 8)` ⚠️ **MISMATCH**
- `price_event.quantity`: `NUMERIC(18, 8)` ⚠️ **MISMATCH**
- `token_price_history.price`: `NUMERIC(18, 8)` ⚠️ **MISMATCH**
- `token_price_history.volume`: `NUMERIC(18, 8)` ⚠️ **MISMATCH**

**Recommendation:** Change to `NUMERIC(18, 6)` to match existing schema pattern.

---

## 4. COLUMN NAMING CONVENTIONS

### Existing Patterns:

**Mixed Naming Convention Found:**
- **camelCase** (TypeORM entities): `properties` table uses `displayCode`, `organizationId`, `createdAt`
- **snake_case** (Manual migrations): `marketplace_trades` uses `display_code`, `property_id`, `created_at`

**Proposed Schema:**
- Uses **snake_case**: `property_id`, `actor_id`, `created_at` ✅
- Matches `marketplace_trades` and `marketplace_listings` pattern ✅

**Result:** Consistent with marketplace tables (snake_case).

---

## 5. INDEX CONFLICTS

### Existing Indexes Checked:
```sql
-- No indexes found with names:
- idx_price_event_*
- idx_token_price_history_*
```

**Proposed Indexes:**
- `idx_price_event_property_id` ✅ Safe
- `idx_price_event_created_at` ✅ Safe
- `idx_price_event_type` ✅ Safe
- `idx_price_event_property_created` ✅ Safe
- `idx_token_price_history_property_time` ✅ Safe
- `idx_token_price_history_time` ✅ Safe
- `idx_token_price_history_price_source` ✅ Safe

**Result:** No index name conflicts.

---

## 6. CONSTRAINT CONFLICTS

### Existing Constraints:
- Only price-related constraints found:
  - `marketplace_listings_price_per_token_check`
  - `marketplace_trades_price_per_token_check`

**Proposed Constraints:**
- `CHECK (event_type IN (...))` ✅ Safe (unique constraint name)
- `CHECK (price_source IN (...))` ✅ Safe (unique constraint name)
- `PRIMARY KEY (property_id, time)` ✅ Safe (composite key, unique pattern)

**Result:** No constraint name conflicts.

---

## 7. SEQUENCE CONFLICTS

### Existing Sequences:
- `bank_transfer_display_seq`
- `bank_withdrawal_display_seq`
- `investment_display_seq`
- `marketplace_listing_display_seq`
- `marketplace_trade_display_seq`
- `organization_display_seq`
- `property_display_seq`
- `reward_display_seq`
- `transaction_display_seq`
- `user_display_seq`

**Proposed Schema:**
- Uses `gen_random_uuid()` for IDs (no sequences needed) ✅

**Result:** No sequence conflicts.

---

## 8. TIMESCALEDB EXTENSION

### Current Extensions:
```sql
extname      | extversion
-------------+------------
uuid-ossp    | 1.1
```

**TimescaleDB Status:** ❌ **NOT INSTALLED**

**Impact:**
- Cannot use `create_hypertable()` function
- Must use regular PostgreSQL table
- Can still partition manually if needed

**Recommendation:**
1. **Option A (Recommended):** Use regular PostgreSQL table without hypertable
2. **Option B:** Request TimescaleDB from Neon support (may require upgrade)

---

## 9. UUID EXTENSION

### Status:
- ✅ `uuid-ossp` extension is **INSTALLED** (version 1.1)
- ✅ Can use `gen_random_uuid()` for primary keys

**Result:** UUID generation available.

---

## 10. CRITICAL FINDINGS & RECOMMENDATIONS

### ⚠️ Issue 1: Numeric Precision Mismatch

**Problem:** Proposed schema uses `NUMERIC(18, 8)` but existing tables use `NUMERIC(18, 6)`

**Fix Required:**
```sql
-- Change from:
price NUMERIC(18, 8)
-- To:
price NUMERIC(18, 6)  -- Matches existing pattern
```

### ⚠️ Issue 2: TimescaleDB Not Available

**Problem:** Cannot use `create_hypertable()` function

**Solution:** Use regular PostgreSQL table. For time-series queries, add proper indexes:
```sql
CREATE INDEX idx_token_price_history_time_property 
ON token_price_history(time DESC, property_id);
```

### ✅ Issue 3: Column Naming Consistency

**Status:** Good - Uses snake_case matching marketplace tables

---

## 11. RECOMMENDED MIGRATION SCRIPT

See: `add-price-history-tables.sql` (to be created)

**Key Changes from Original:**
1. Change all `NUMERIC(18, 8)` → `NUMERIC(18, 6)`
2. Remove TimescaleDB hypertable conversion
3. Add additional indexes for time-series queries
4. Use `snake_case` for all column names

---

## 12. VERIFICATION QUERIES

After migration, run these to verify:

```sql
-- 1. Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('price_event', 'token_price_history');

-- 2. Verify foreign keys
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND table_name IN ('price_event', 'token_price_history');

-- 3. Verify indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('price_event', 'token_price_history');

-- 4. Verify numeric precision
SELECT column_name, data_type, numeric_precision, numeric_scale 
FROM information_schema.columns 
WHERE table_name IN ('price_event', 'token_price_history') 
AND data_type = 'numeric';
```

---

## 13. FINAL VERDICT

✅ **SAFE TO IMPLEMENT** with the following modifications:

1. ✅ Change numeric precision from `(18, 8)` to `(18, 6)`
2. ✅ Remove TimescaleDB hypertable (use regular table)
3. ✅ Add time-series optimized indexes
4. ✅ All other aspects are conflict-free

**Confidence Level:** 100% - Database analysis complete, no blocking issues found.

