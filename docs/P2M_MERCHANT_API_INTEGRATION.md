# 1LINK P2M Merchant Profile API Integration

This document describes the P2M (Person-to-Merchant) Merchant Profile API integration for 1LINK 1GO (RAAST P2M).

## Overview

The P2M Merchant Profile APIs are prerequisites for generating dynamic P2M QR codes. These APIs allow you to:
- Create and manage merchant profiles in the 1LINK system
- Update merchant information
- Receive transaction status notifications
- Handle payment notifications for instant settlement

## Endpoints

All endpoints are prefixed with `/api/payments/1link/merchant`

### 1. Create Merchant Profile

**Endpoint:** `POST /api/payments/1link/merchant/profile`

**Authentication:** JWT Bearer Token (required)

**Request Body:**
```json
{
  "merchantDetails": {
    "dbaName": "My Business Name",
    "merchantName": "My Merchant Name",
    "iban": "PK36SCBL0000001123456702",
    "bankBic": "SCBLPK",
    "merchantCategoryCode": "0010",
    "merchantID": "MERCHANT001",
    "accountTitle": "My Account Title",
    "postalAddress": {
      "townName": "Karachi",
      "addressLine": "123 Main Street"
    },
    "contactDetails": {
      "phoneNo": "02112345678",
      "mobileNo": "03001234567",
      "email": "merchant@example.com",
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
  "responseDescription": "Processed OK",
  "merchantProfile": {
    "id": "uuid",
    "merchantID": "MERCHANT001",
    "dbaName": "My Business Name",
    ...
  }
}
```

### 2. Update Merchant Profile

**Endpoint:** `POST /api/payments/1link/merchant/profile/update`

**Authentication:** JWT Bearer Token (required)

**Request Body:**
```json
{
  "merchantDetails": {
    "merchantStatus": "00",
    "reasonCode": "Optional reason",
    "dbaName": "Updated Business Name",
    "merchantName": "Updated Merchant Name",
    "iban": "PK36SCBL0000001123456702",
    "bankBic": "SCBLPK",
    "merchantCategoryCode": "0010",
    "merchantID": "MERCHANT001",
    "accountTitle": "Updated Account Title"
  }
}
```

**Merchant Status Codes:**
- `00` = Active
- `01` = Inactive
- `02` = Blocked

**Response:**
```json
{
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "merchantProfile": { ... }
}
```

### 3. Get Merchant Profile

**Endpoint:** `GET /api/payments/1link/merchant/profile?merchantID=MERCHANT001`

**Authentication:** JWT Bearer Token (required)

**Query Parameters:**
- `merchantID` (required): The merchant ID to retrieve

**Response:**
```json
{
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "merchantProfile": { ... }
}
```

### 4. Create Merchant Profile Version 2

**Endpoint:** `POST /api/payments/1link/merchant/profile/v2`

**Authentication:** JWT Bearer Token (required)

Same payload structure as Create Merchant Profile (v1), but uses the v2 API endpoint.

### 5. List All Merchant Profiles

**Endpoint:** `GET /api/payments/1link/merchant/profiles`

**Authentication:** JWT Bearer Token (required)

**Response:**
```json
{
  "success": true,
  "count": 2,
  "profiles": [
    {
      "id": "uuid",
      "merchantID": "MERCHANT001",
      "dbaName": "My Business",
      ...
    }
  ]
}
```

### 6. Notify Merchant (Webhook)

**Endpoint:** `POST /api/payments/1link/merchant/notify`

**Authentication:** None (called by 1LINK)

This endpoint receives transaction status notifications from 1LINK. Configure this URL in your 1LINK merchant dashboard.

**Request Body (from 1LINK):**
```json
{
  "info": {
    "rrn": "123456789012",
    "stan": "123456",
    "dateTime": "2025-01-12T10:00:00Z"
  },
  "messageInfo": {
    "merchantID": "MERCHANT001",
    "subDept": "Optional",
    "status": "ACCP"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification received and processed"
}
```

### 7. Payment Notification (Webhook)

**Endpoint:** `POST /api/payments/1link/merchant/payment-notification`

**Authentication:** None (called by 1LINK)

This endpoint receives payment notifications from 1LINK for instant settlement. Configure this URL in your 1LINK merchant dashboard.

**Request Body (from 1LINK):**
```json
{
  "info": {
    "rrn": "123456789012",
    "stan": "123456",
    "dateTime": "2025-01-12T10:00:00Z"
  },
  "messageInfo": {
    "merchantID": "MERCHANT001",
    "subDept": "Optional",
    "status": "ACCP",
    "orginalInstructedAmount": "1000.00",
    "netAmount": "985.00"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment notification received and processed"
}
```

## Field Validation

### Required Fields (Create Merchant Profile)
- `dbaName` (max 140 chars)
- `merchantName` (max 140 chars)
- `iban` (max 24 chars, must start with PK)
- `bankBic` (max 6 chars)
- `merchantCategoryCode` (max 35 chars)
- `merchantID` (max 35 chars, unique)
- `accountTitle` (max 140 chars)

### Optional Fields
- `postalAddress` (if provided, `townName` and `addressLine` are required)
- `contactDetails` (all fields optional)
- `paymentDetails` (if provided, `feeType` and `feeValue` are required)

### Payment Details
- `feeType`: `"F"` (Fixed) or `"P"` (Percentage)
- `feeValue`: Number (e.g., 15 for 15 PKR or 15%)

## Environment Variables

The following environment variables are used (shared with RTP APIs):

```env
# 1LINK OAuth & API Configuration
ONELINK_CLIENT_ID=3fbc282ce1f63e22297a8e4ce10b6aca
ONELINK_CLIENT_SECRET=dab7c9ebda0046ea07b0d8e705d56ff7
ONELINK_OAUTH_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/oauth2/token

# P2M Merchant API Base URL (same as RTP API)
ONELINK_RTP_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link
# OR
ONELINK_MERCHANT_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link
```

## Database

The merchant profiles are stored in the `merchant_profiles` table. Run the migration:

```bash
npm run migrate
```

Or manually execute:
```sql
-- See: database/migrations/016_create_merchant_profiles.sql
```

## Error Handling

All endpoints return standard HTTP status codes:
- `200 OK`: Success
- `400 Bad Request`: Validation error or invalid input
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Merchant profile not found (for update/get operations)
- `500 Internal Server Error`: 1LINK API error or server error

## Testing

### Create Merchant Profile

```bash
curl -X POST http://localhost:3000/api/payments/1link/merchant/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "merchantDetails": {
      "dbaName": "Test Business",
      "merchantName": "Test Merchant",
      "iban": "PK36SCBL0000001123456702",
      "bankBic": "SCBLPK",
      "merchantCategoryCode": "0010",
      "merchantID": "TEST001",
      "accountTitle": "Test Account"
    }
  }'
```

### Get Merchant Profile

```bash
curl -X GET "http://localhost:3000/api/payments/1link/merchant/profile?merchantID=TEST001" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Update Merchant Profile

```bash
curl -X POST http://localhost:3000/api/payments/1link/merchant/profile/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "merchantDetails": {
      "merchantStatus": "00",
      "dbaName": "Updated Business",
      "merchantName": "Updated Merchant",
      "iban": "PK36SCBL0000001123456702",
      "bankBic": "SCBLPK",
      "merchantCategoryCode": "0010",
      "merchantID": "TEST001",
      "accountTitle": "Updated Account"
    }
  }'
```

## Implementation Notes

1. **OAuth Token Management**: The service uses the existing `OneLinkOAuthService` for token management with automatic caching and refresh.

2. **Retry Logic**: All API calls include retry logic (max 2 retries) with automatic token refresh on 401 errors.

3. **Database Storage**: Merchant profiles are stored locally for audit and quick access. The database record includes:
   - All merchant details
   - Last request/response payloads
   - Response codes and descriptions

4. **Webhook Security**: The webhook endpoints (`/notify` and `/payment-notification`) do not require authentication as they are called by 1LINK. Consider adding:
   - IP whitelisting
   - Signature verification
   - Rate limiting

5. **Payload Validation**: All DTOs include strict validation with max length constraints matching the 1LINK API requirements.

## Next Steps

After creating a merchant profile, you can proceed to:
1. Generate dynamic P2M QR codes (to be implemented)
2. Configure webhook URLs in 1LINK merchant dashboard
3. Test payment flows with real bank accounts

## References

- 1LINK P2M Merchant API Documentation: `docs/P2M_merchantAPI.txt`
- 1LINK Sandbox Base URL: `https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link`


