# Testing P2M Merchant APIs Without Real Data

## Overview

Since 1LINK sandbox returns response code "11" (merchant not registered) for test merchant IDs, we've added a **test mode** that bypasses the 1LINK API and creates merchant profiles locally for testing.

## Test Mode Endpoint

### Create Test Merchant Profile

**Endpoint:** `POST /api/payments/1link/merchant/profile/test`

**Authentication:** JWT Bearer Token (required)

**Request Body:** Same as Create Merchant Profile
```json
{
  "merchantDetails": {
    "dbaName": "Test Business Name",
    "merchantName": "Test Merchant",
    "iban": "PK36SCBL0000001123456702",
    "bankBic": "SCBLPK",
    "merchantCategoryCode": "0010",
    "merchantID": "TEST_MERCHANT_001",
    "accountTitle": "Test Account Title",
    "postalAddress": {
      "townName": "Karachi",
      "addressLine": "123 Test Street"
    },
    "contactDetails": {
      "phoneNo": "+922112345678",
      "mobileNo": "+923001234567",
      "email": "test@example.com",
      "dept": "Sales",
      "website": "https://example.com"
    },
    "paymentDetails": {
      "feeType": "F",
      "feeValue": 15
    }
  }
}
```

**Response:**
```json
{
  "responseCode": "00",
  "responseDescription": "Test merchant profile created (sandbox mode)",
  "merchantProfile": {
    "id": "uuid",
    "merchantID": "TEST_MERCHANT_001",
    "dbaName": "Test Business Name",
    "merchantStatus": "00",
    ...
  }
}
```

## Testing Workflow

### Step 1: Create Test Merchant Profile

```bash
curl -X POST http://localhost:3000/api/payments/1link/merchant/profile/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "merchantDetails": {
      "dbaName": "Test Business",
      "merchantName": "Test Merchant",
      "iban": "PK36SCBL0000001123456702",
      "bankBic": "SCBLPK",
      "merchantCategoryCode": "0010",
      "merchantID": "TEST_001",
      "accountTitle": "Test Account",
      "contactDetails": {
        "phoneNo": "+922112345678",
        "mobileNo": "+923001234567",
        "email": "test@example.com"
      }
    }
  }'
```

### Step 2: Get Test Merchant Profile

```bash
curl -X GET "http://localhost:3000/api/payments/1link/merchant/profile?merchantID=TEST_001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 3: List All Test Merchants

```bash
curl -X GET http://localhost:3000/api/payments/1link/merchant/profiles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 4: Use Test Merchant for P2M QR Code (Future)

Once P2M QR code is implemented, you can use the test merchant:

```bash
curl -X POST http://localhost:3000/api/payments/1link/p2m/qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "merchantID": "TEST_001",
    "amountPkr": 2500,
    "referenceId": "ORDER-12345",
    "purpose": "Test Payment"
  }'
```

## Test Script

Use the PowerShell test script with test mode:

```powershell
# Update test-merchant-apis.ps1 to use /profile/test endpoint
# Or create a separate test script for test mode
```

## Key Differences: Test Mode vs Real Mode

| Feature | Test Mode | Real Mode |
|---------|-----------|-----------|
| **Endpoint** | `/profile/test` | `/profile` |
| **1LINK API Call** | ❌ Bypassed | ✅ Called |
| **Response Code** | Always "00" | "00" or "11" |
| **Database** | ✅ Saved | ✅ Saved |
| **Use Case** | Development/Testing | Production |

## Benefits of Test Mode

1. **No 1LINK API Dependency**: Test without real merchant registration
2. **Fast Testing**: No network calls to 1LINK
3. **Consistent Results**: Always returns success
4. **Development Friendly**: Perfect for local development
5. **Cost Effective**: No API call limits

## Limitations of Test Mode

1. **Not Real**: Merchant profile not registered with 1LINK
2. **No QR Code Generation**: Can't generate real P2M QR codes (yet)
3. **No Payment Processing**: Can't process real payments
4. **Testing Only**: Should not be used in production

## Migration Path

**Development:**
1. Use test mode to create test merchants
2. Test your application logic
3. Verify database operations

**Staging/Production:**
1. Register real merchants with 1LINK
2. Use real mode (`/profile` endpoint)
3. Generate real P2M QR codes
4. Process real payments

## Example: Complete Test Flow

```bash
# 1. Create test merchant
POST /api/payments/1link/merchant/profile/test
→ Returns: { "responseCode": "00", "merchantProfile": {...} }

# 2. Verify merchant exists
GET /api/payments/1link/merchant/profile?merchantID=TEST_001
→ Returns: { "responseCode": "00", "merchantProfile": {...} }

# 3. List all test merchants
GET /api/payments/1link/merchant/profiles
→ Returns: { "count": 1, "profiles": [...] }

# 4. (Future) Generate P2M QR code
POST /api/payments/1link/p2m/qr
→ Returns: { "qrCodeBase64": "...", ... }
```

## Notes

- **Phone Numbers**: Must be in international format (13-15 digits)
  - ✅ `+923001234567` (13 digits)
  - ❌ `03001234567` (11 digits)

- **Merchant ID**: Must be unique
  - Use timestamp: `TEST_$(Get-Date -Format 'yyyyMMddHHmmss')`
  - Or use descriptive names: `TEST_MERCHANT_001`

- **Database**: Test merchants are saved in `merchant_profiles` table
  - Can be queried like real merchants
  - Can be used for P2M QR code generation (once implemented)

## Next Steps

1. ✅ Test mode endpoint created
2. ⏳ Test P2M QR code generation (waiting for API docs)
3. ⏳ Integrate with payment flow
4. ⏳ Add webhook handling for payments


