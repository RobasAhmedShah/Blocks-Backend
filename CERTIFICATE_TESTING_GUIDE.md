# Certificate Testing Guide - Postman APIs

## 🎯 Purpose
Test and verify that PDF certificates are being generated and saved to Neon database when investments are created.

---

## 📋 Setup

### 1. Import Postman Collection
1. Open Postman
2. Click **Import** button
3. Select `Certificate_Testing_Postman_Collection.json`
4. Collection will be imported with all test endpoints

### 2. Set Base URL
- Default: `http://localhost:3000`
- Change in Postman: Click on collection → Variables tab → Update `baseUrl`

---

## 🔍 Test Endpoints

### **1. Check Certificate in Database**
**GET** `/api/mobile/certificates/test/check/:transactionId`

**Purpose:** Check if `certificatePath` is saved in Neon for a transaction and investment.

**Example Request:**
```
GET http://localhost:3000/api/mobile/certificates/test/check/TXN-000001
```

**Example Response (Success):**
```json
{
  "success": true,
  "transaction": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "displayCode": "TXN-000001",
    "userId": "user-uuid",
    "propertyId": "property-uuid",
    "certificatePath": "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/user-uuid/transaction-uuid.pdf",
    "hasCertificatePath": true
  },
  "investment": {
    "id": "investment-uuid",
    "displayCode": "INV-000001",
    "userId": "user-uuid",
    "propertyId": "property-uuid",
    "certificatePath": "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/user-uuid/transaction-uuid.pdf",
    "hasCertificatePath": true
  }
}
```

**Example Response (No Certificate):**
```json
{
  "success": true,
  "transaction": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "displayCode": "TXN-000001",
    "certificatePath": null,
    "hasCertificatePath": false
  },
  "investment": {
    "certificatePath": null,
    "hasCertificatePath": false
  }
}
```

---

### **2. Manually Generate Certificate**
**POST** `/api/mobile/certificates/test/generate/:transactionId`

**Purpose:** Manually trigger certificate generation and verify it saves to Neon. This is the main test endpoint.

**Example Request:**
```
POST http://localhost:3000/api/mobile/certificates/test/generate/TXN-000001
```

**Example Response (Success):**
```json
{
  "success": true,
  "message": "Certificate generated successfully",
  "certificate": {
    "certificatePath": "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/user-uuid/transaction-uuid.pdf",
    "signedUrl": "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/sign-url/..."
  },
  "databaseCheck": {
    "transaction": {
      "id": "transaction-uuid",
      "displayCode": "TXN-000001",
      "certificatePath": "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/user-uuid/transaction-uuid.pdf",
      "saved": true
    },
    "investment": {
      "id": "investment-uuid",
      "displayCode": "INV-000001",
      "certificatePath": "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/user-uuid/transaction-uuid.pdf",
      "saved": true
    }
  }
}
```

**Example Response (Error):**
```json
{
  "success": false,
  "error": "Transaction not found: TXN-000001",
  "stack": "..."
}
```

**Key Fields to Check:**
- ✅ `databaseCheck.transaction.saved` should be `true`
- ✅ `databaseCheck.investment.saved` should be `true`
- ✅ Both should have `certificatePath` URLs

---

### **3. Get Transaction Certificate (Auto-generate)**
**GET** `/api/mobile/certificates/transactions/:transactionId`

**Purpose:** Get certificate PDF URL. Auto-generates if missing.

**Example Request:**
```
GET http://localhost:3000/api/mobile/certificates/transactions/TXN-000001
```

**Example Response:**
```json
{
  "success": true,
  "transactionId": "transaction-uuid",
  "pdfUrl": "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/sign-url/..."
}
```

---

### **4. Get Investment by Transaction**
**GET** `/api/mobile/investments?transactionId=:transactionId`

**Purpose:** Find investment related to transaction to verify `certificatePath`.

**Example Request:**
```
GET http://localhost:3000/api/mobile/investments?transactionId=TXN-000001
```

---

### **5. Get All Investments for User**
**GET** `/api/mobile/investments?userId=:userId`

**Purpose:** Get all investments for a user to check `certificatePath` values.

**Example Request:**
```
GET http://localhost:3000/api/mobile/investments?userId=USER-000001
```

**Example Response:**
```json
{
  "success": true,
  "investments": [
    {
      "id": "investment-uuid",
      "displayCode": "INV-000001",
      "certificatePath": "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/user-uuid/transaction-uuid.pdf",
      "tokensPurchased": "100.000000",
      "amountUSDT": "1000.000000",
      "status": "confirmed"
    }
  ]
}
```

---

## 🧪 Testing Workflow

### **Step 1: Find a Transaction ID**
1. Make an investment OR
2. Query your database for a transaction:
   ```sql
   SELECT id, "displayCode", "userId", "propertyId", "certificatePath"
   FROM transactions
   WHERE type = 'investment' AND status = 'completed'
   LIMIT 1;
   ```

### **Step 2: Check Current State**
```
GET /api/mobile/certificates/test/check/{transactionId}
```
- If `hasCertificatePath: false` → Certificate not saved yet
- If `hasCertificatePath: true` → Certificate already exists

### **Step 3: Generate Certificate**
```
POST /api/mobile/certificates/test/generate/{transactionId}
```
- Check `databaseCheck.transaction.saved` → Should be `true`
- Check `databaseCheck.investment.saved` → Should be `true`
- Both should have `certificatePath` URLs

### **Step 4: Verify in Database**
Run this SQL in Neon:
```sql
-- Check transaction
SELECT id, "displayCode", "certificatePath"
FROM transactions
WHERE id = 'your-transaction-uuid';

-- Check investment
SELECT id, "displayCode", "certificatePath"
FROM investments
WHERE "userId" = 'your-user-uuid'
  AND "propertyId" = 'your-property-uuid'
ORDER BY "createdAt" DESC
LIMIT 1;
```

---

## 🐛 Troubleshooting

### **Problem: `saved: false` in response**
**Possible Causes:**
1. Database connection issue
2. Transaction not committed
3. Investment not found
4. TypeORM save() failed silently

**Solution:**
- Check server logs for errors
- Verify transaction exists in database
- Check if investment exists for that user/property

### **Problem: Certificate generated but not saved**
**Possible Causes:**
1. Database transaction rollback
2. Entity not properly loaded
3. Save() called on wrong entity instance

**Solution:**
- Check `certificates.service.ts` line 191-193 (transaction save)
- Check `certificates.service.ts` line 224-225 (investment save)
- Verify both saves are happening

### **Problem: `certificatePath` is null in database**
**Possible Causes:**
1. Save operation failed
2. Entity not refreshed after save
3. Database column doesn't exist

**Solution:**
- Run migration: `database/migrations/add-certificate-path-to-investments.sql`
- Check if column exists:
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'investments' AND column_name = 'certificatePath';
  ```

---

## 📊 Expected Database State

After successful certificate generation:

### **transactions table:**
```sql
certificatePath: "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/{userId}/{transactionId}.pdf"
```

### **investments table:**
```sql
certificatePath: "https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/{userId}/{transactionId}.pdf"
```

---

## ✅ Success Criteria

1. ✅ Certificate PDF generated and uploaded to Supabase
2. ✅ `transactions.certificatePath` saved in Neon
3. ✅ `investments.certificatePath` saved in Neon
4. ✅ Both paths are full URLs (not relative paths)
5. ✅ PDF URL is accessible and opens correctly

---

## 🔗 Quick Test URLs

Replace `{baseUrl}` and `{transactionId}`:

1. **Check:** `GET {baseUrl}/api/mobile/certificates/test/check/{transactionId}`
2. **Generate:** `POST {baseUrl}/api/mobile/certificates/test/generate/{transactionId}`
3. **Get PDF:** `GET {baseUrl}/api/mobile/certificates/transactions/{transactionId}`

---

## 📝 Notes

- All endpoints are marked `@Public()` so no authentication needed for testing
- Supports both UUID and Display Code for transaction IDs
- Certificate generation is async and may take a few seconds
- Check server logs for detailed error messages

