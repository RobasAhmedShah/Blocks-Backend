# P2M QR Code Integration

This document describes the P2M (Person-to-Merchant) Dynamic QR Code API integration for 1LINK 1GO (RAAST P2M).

## Overview

The P2M QR Code API generates **dynamic QR codes** for merchant payments. Unlike static P2P QR codes, P2M QR codes:
- Are unique per transaction
- Include transaction amount
- Have expiry dates
- Are tied to registered merchant profiles
- Can be tracked via STAN and RRN

## Prerequisites

Before generating P2M QR codes, you must:
1. ✅ Create a merchant profile using `/api/payments/1link/merchant/profile` or `/api/payments/1link/merchant/profile/test`
2. ✅ Ensure merchant profile status is `00` (Active)

## Endpoints

All endpoints are prefixed with `/api/payments/1link`

### 1. Generate P2M QR Code - Merchant Mode

**Endpoint:** `POST /api/payments/1link/p2m/qr`

**Authentication:** JWT Bearer Token (required)

**Request Body:**
```json
{
  "merchantID": "MERCHANT001",
  "amountPkr": 2500,
  "referenceId": "ORDER-12345",
  "purpose": "Payment for Order",
  "transactionType": "PURCHASE",
  "expiryMinutes": 30,
  "subDept": "0001",
  "loyaltyNo": "LOYALTY123",
  "customerLabel": "VIP Customer"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchantID` | string | Yes | Merchant ID from merchant profile |
| `amountPkr` | number | Yes | Amount in PKR (1-500,000) |
| `referenceId` | string | No | Order/invoice reference (auto-generated if not provided) |
| `purpose` | string | No | Purpose of payment |
| `transactionType` | string | No | Transaction type (default: "PURCHASE") |
| `expiryMinutes` | number | No | QR expiry in minutes (default: 30) |
| `subDept` | string | No | Terminal ID (default: "0001") |
| `loyaltyNo` | string | No | Loyalty number |
| `customerLabel` | string | No | Customer label |

**Response:**
```json
{
  "qrCodeId": "P2M-1734567890123-abc123",
  "merchantID": "MERCHANT001",
  "referenceId": "ORDER-12345",
  "amountPkr": "2500",
  "qrCodeBase64": "<BASE64_PNG_STRING>",
  "qrCodeDataUri": "data:image/png;base64,<BASE64_PNG_STRING>",
  "qrData": "<QR_DATA_STRING>",
  "expiryDateTime": "2025-01-12T10:30:00",
  "currency": "PKR",
  "stan": "123456",
  "rrn": "250112123456"
}
```

### 2. Generate P2M QR Code - Aggregator Mode

**Endpoint:** `POST /api/payments/1link/p2m/qr/aggregator`

**Authentication:** JWT Bearer Token (required)

**Request Body:** Same as Merchant Mode

**Response:** Same as Merchant Mode

**Differences:**
- Requires less merchant details (only merchantID and subDept)
- Uses aggregator API endpoint
- Suitable for platforms managing multiple merchants

## Implementation Details

### STAN and RRN Generation

- **STAN (System Trace Audit Number)**: 6-digit unique number, auto-generated
- **RRN (Retrieval Reference Number)**: 12-digit unique number, format: `YYMMDD` + 6-digit sequence

### Amount Conversion

Amounts are converted to smallest currency unit:
- Input: `2500` PKR
- API: `250000` (2500 * 100)

### Expiry Date/Time

- Default: 30 minutes from generation
- Format: ISO 8601 (`YYYY-MM-DDTHH:mm:ss`)
- Max length: 20 characters

### Merchant Profile Integration

The service automatically:
1. Fetches merchant profile from database
2. Validates merchant is active (status: `00`)
3. Uses merchant details (IBAN, BIC, MCC, etc.) in QR payload
4. Formats phone numbers to international format (13-15 digits)

## Error Handling

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid amount, missing merchantID, or merchant not active |
| 404 | Not Found | Merchant profile not found |
| 500 | Internal Server Error | 1LINK API error or server error |

## Testing

### Step 1: Create Test Merchant Profile

```bash
POST /api/payments/1link/merchant/profile/test
{
  "merchantDetails": {
    "dbaName": "Test Business",
    "merchantName": "Test Merchant",
    "iban": "PK36SCBL0000001123456702",
    "bankBic": "SCBLPK",
    "merchantCategoryCode": "0010",
    "merchantID": "TEST_001",
    "accountTitle": "Test Account",
    "postalAddress": {
      "townName": "Karachi",
      "addressLine": "123 Test Street",
      "subDept": "0001"
    },
    "contactDetails": {
      "phoneNo": "+922112345678",
      "mobileNo": "+923001234567",
      "email": "test@example.com"
    }
  }
}
```

### Step 2: Generate P2M QR Code

```bash
POST /api/payments/1link/p2m/qr
{
  "merchantID": "TEST_001",
  "amountPkr": 2500,
  "referenceId": "ORDER-12345"
}
```

## Environment Variables

Uses the same environment variables as merchant profile APIs:

```env
ONELINK_CLIENT_ID=3fbc282ce1f63e22297a8e4ce10b6aca
ONELINK_CLIENT_SECRET=dab7c9ebda0046ea07b0d8e705d56ff7
ONELINK_OAUTH_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/oauth2/token
ONELINK_RTP_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link
```

## API Endpoints (1LINK)

- **Merchant Mode**: `POST /generateDQRCMerchant`
- **Aggregator Mode**: `POST /generateDQRCAggregator`

Base URL: `https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link`

## Payload Structure

### Merchant Mode Payload

```json
{
  "merchantDetails": {
    "dbaName": "Test Business",
    "merchantName": "Test Merchant",
    "iban": "PK36SCBL0000001123456702",
    "bankBic": "SCBLPK",
    "merchantCategoryCode": "0010",
    "merchantID": "TEST_001",
    "postalAddress": {
      "townName": "Karachi",
      "addressLine": "123 Test Street",
      "subDept": "0001"
    },
    "contactDetails": {
      "phoneNo": "+922112345678",
      "mobileNo": "+923001234567",
      "email": "test@example.com"
    }
  },
  "paymentDetails": {
    "executionDateTime": "2025-01-12T10:00:00",
    "expiryDateTime": "2025-01-12T10:30:00",
    "instructedAmount": 250000,
    "transactionType": "PURCHASE"
  },
  "info": {
    "stan": "123456",
    "rrn": "250112123456"
  }
}
```

### Aggregator Mode Payload

```json
{
  "merchantDetails": {
    "merchantID": "TEST_001",
    "subDept": "0001"
  },
  "payerDetails": {
    "paymentDetails": {
      "executionDateTime": "2025-01-12T10:00:00",
      "expiryDateTime": "2025-01-12T10:30:00",
      "instructedAmount": 250000,
      "transactionType": "PURCHASE"
    },
    "info": {
      "stan": "123456",
      "rrn": "250112123456"
    }
  }
}
```

## Notes

1. **Postal Address**: Required for merchant mode (townName, addressLine, subDept)
2. **Phone Numbers**: Must be 13-15 digits in international format (e.g., `+923001234567`)
3. **Amount**: Converted to smallest currency unit (multiply by 100)
4. **Expiry**: Default 30 minutes, can be customized
5. **QR Code Response**: May not include QR code in response (check `qrData` field)

## Next Steps

1. ✅ P2M QR code generation implemented
2. ⏳ Test with real merchant profiles
3. ⏳ Integrate with payment flow
4. ⏳ Handle payment notifications via webhooks


