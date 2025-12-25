# 1LINK Payment Integration

This document describes the 1LINK payment integrations:
1. **1QR** - QR code generation for wallet deposits
2. **1GO (RAAST P2M)** - Request to Pay (RTP) for direct payment requests

## Overview

The integration allows mobile app users to generate a 1LINK compatible QR code that can be scanned by any Pakistani banking app to deposit funds into their Blocks wallet.

## Endpoint

### Generate 1QR Code

```
POST /api/payments/1link/1qr
```

**Authentication:** JWT Bearer Token (required)

**Request Body:**

```json
{
  "amountPkr": 2500,
  "userId": "user-uuid-here",
  "purpose": "Wallet Top Up"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amountPkr` | number | Yes | Amount in PKR (1 - 500,000) |
| `userId` | string | No | User UUID (uses authenticated user if not provided) |
| `purpose` | string | No | Purpose of transaction (default: "Wallet Top Up") |

**Success Response (200 OK):**

```json
{
  "depositId": "DEP-1734567890123-abc123",
  "referenceId": "DEP-USER1234-1734567890123",
  "amountPkr": "2500",
  "qrCodeBase64": "<BASE64_PNG_STRING>",
  "qrCodeDataUri": "data:image/png;base64,<BASE64_PNG_STRING>",
  "currency": "PKR"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid amount or missing required fields |
| 401 | Unauthorized | Missing or invalid JWT token |
| 500 | Internal Server Error | OAuth failure or 1LINK API error |

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# 1LINK Sandbox Credentials
ONELINK_CLIENT_ID=3fbc282ce1f63e22297a8e4ce10b6aca
ONELINK_CLIENT_SECRET=dab7c9ebda0046ea07b0d8e705d56ff7
ONELINK_OAUTH_URL=https://sbapi.1link.net.pk/uat-1link/sandbox/oauth2/token
ONELINK_QR_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/qr-rest-service
ONELINK_IBM_CLIENT_ID=3fbc282ce1f63e22297a8e4ce10b6aca

# Merchant Configuration
ONELINK_MERCHANT_NAME=Blocks
ONELINK_MERCHANT_CITY=Karachi
ONELINK_MCC=0010
ONELINK_PAYEE_GUID=A000000736
ONELINK_PAYEE_BANK_IMD=435345
ONELINK_PAYEE_ACCOUNT_NUMBER=IBAN220011194544555666
ONELINK_PRODUCT_GUID=A00000736
ONELINK_PRODUCT_CODE=000081
```

### Variable Descriptions

| Variable | Description | Constraint |
|----------|-------------|------------|
| `ONELINK_CLIENT_ID` | OAuth2 Client ID | Required |
| `ONELINK_CLIENT_SECRET` | OAuth2 Client Secret | Required |
| `ONELINK_OAUTH_URL` | OAuth2 Token Endpoint | Required |
| `ONELINK_QR_API_URL` | QR Generation API Base URL | Required |
| `ONELINK_IBM_CLIENT_ID` | X-IBM-Client-Id header value | Required |
| `ONELINK_MERCHANT_NAME` | Merchant name in QR | Max 25 chars |
| `ONELINK_MERCHANT_CITY` | Merchant city in QR | Max 15 chars |
| `ONELINK_MCC` | Merchant Category Code | Exactly 4 digits |
| `ONELINK_PAYEE_GUID` | Payee Globally Unique ID | Max 32 chars |
| `ONELINK_PAYEE_BANK_IMD` | Payee Bank IMD | 6-11 chars |
| `ONELINK_PAYEE_ACCOUNT_NUMBER` | Payee IBAN/Account | Max 24 chars |
| `ONELINK_PRODUCT_GUID` | Product Globally Unique ID | 1-32 chars |
| `ONELINK_PRODUCT_CODE` | Product Code | Max 44 chars |

## OAuth Token Caching

The integration implements automatic OAuth token caching:

- Tokens are cached in memory until expiry
- A 60-second buffer is applied before token expiry to refresh proactively
- Token is automatically refreshed when expired
- On authentication errors, the token cache is invalidated and a new token is fetched

## Retry Logic

The QR generation API includes built-in retry logic:

- Maximum of 2 retry attempts on failure
- 1-second delay between retries
- Token cache is invalidated on authentication errors before retry

## Testing

### cURL Examples

**1. Generate QR Code:**

```bash
curl -X POST http://localhost:3000/api/payments/1link/1qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "amountPkr": 2500
  }'
```

**2. Generate QR Code with custom purpose:**

```bash
curl -X POST http://localhost:3000/api/payments/1link/1qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "amountPkr": 5000,
    "purpose": "Investment Deposit"
  }'
```

### Sample Success Response

```json
{
  "depositId": "DEP-1734567890123-x7k9m2",
  "referenceId": "DEP-AB12CD34-1734567890123",
  "amountPkr": "2500",
  "qrCodeBase64": "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADMElEQVR4nOzVwQ...",
  "qrCodeDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADMElEQVR4nOzVwQ...",
  "currency": "PKR"
}
```

### Sample Error Responses

**Invalid Amount:**

```json
{
  "statusCode": 400,
  "message": "Amount must be between 1 and 500,000 PKR",
  "error": "Bad Request"
}
```

**Authentication Failed:**

```json
{
  "statusCode": 500,
  "message": "Authentication with payment provider failed",
  "error": "Internal Server Error"
}
```

**QR Generation Failed:**

```json
{
  "statusCode": 500,
  "message": "Failed to generate QR code. Please try again later.",
  "error": "Internal Server Error"
}
```

## Postman Collection

Import the following into Postman:

```json
{
  "info": {
    "name": "1LINK 1QR Integration",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "jwtToken",
      "value": "YOUR_JWT_TOKEN_HERE"
    }
  ],
  "item": [
    {
      "name": "Generate 1QR Code",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{jwtToken}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"amountPkr\": 2500,\n  \"purpose\": \"Wallet Top Up\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/payments/1link/1qr",
          "host": ["{{baseUrl}}"],
          "path": ["api", "payments", "1link", "1qr"]
        }
      }
    },
    {
      "name": "Generate 1QR - Minimum Amount",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{jwtToken}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"amountPkr\": 1\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/payments/1link/1qr",
          "host": ["{{baseUrl}}"],
          "path": ["api", "payments", "1link", "1qr"]
        }
      }
    },
    {
      "name": "Generate 1QR - Maximum Amount",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{jwtToken}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"amountPkr\": 500000\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/payments/1link/1qr",
          "host": ["{{baseUrl}}"],
          "path": ["api", "payments", "1link", "1qr"]
        }
      }
    }
  ]
}
```

## Architecture

```
┌─────────────────────┐
│    Mobile App       │
│   (Frontend)        │
└──────────┬──────────┘
           │ POST /api/payments/1link/1qr
           ▼
┌─────────────────────┐
│ OneLinkPayments     │
│ Controller          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ OneLinkQrService    │────▶│ OneLinkOAuthService │
│ (QR Generation)     │     │ (Token Management)  │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           │                           │ OAuth2 Token
           │                           ▼
           │               ┌─────────────────────┐
           │               │ 1LINK OAuth Server  │
           │               │ sbapi.1link.net.pk  │
           │               └─────────────────────┘
           │
           │ QR Generation Request
           ▼
┌─────────────────────┐
│ 1LINK QR API        │
│ sandboxapi.1link... │
└─────────────────────┘
```

## Field Validation Rules

| Field | Constraint | Example |
|-------|------------|---------|
| InitiationMethod | Exactly 2 chars | "12" (dynamic) |
| MCC | Exactly 4 digits | "0010" |
| CurrencyCode | Exactly 3 chars | "586" (PKR) |
| CountryCode | Exactly 2 chars | "PK" |
| MerchantName | 1-25 chars | "Blocks" |
| MerchantCity | 1-15 chars | "Karachi" |
| TransactionAmount | Max 13 chars, max 2 decimals | "2500" |
| GloballyUniqueIdentifier (Payee) | Max 32 chars | "A000000736" |
| PayeeBankIMD | 6-11 chars | "435345" |
| PayeeAccountNumber | Max 24 chars | "IBAN220011194544555666" |
| ProductCode | Max 44 chars | "000081" |
| ReferenceID | Max 25 chars | "DEP-USR-1234567" |
| Purpose | Max 25 chars | "Wallet Top Up" |

## Production Deployment

When deploying to production:

1. Update all environment variables to production values
2. Change OAuth URL to production endpoint
3. Change QR API URL to production endpoint
4. Update merchant credentials with production values
5. Ensure HTTPS is used for all API calls

## Troubleshooting

### Common Issues

**1. OAuth Authentication Failed**
- Verify `ONELINK_CLIENT_ID` and `ONELINK_CLIENT_SECRET` are correct
- Check if the OAuth URL is reachable
- Verify the sandbox credentials haven't expired

**2. QR Generation Failed**
- Check the 1LINK API response for specific error codes
- Verify all field constraints are met
- Check if the API URL is correct

**3. Invalid Response from 1LINK**
- The API may be returning non-JSON response
- Check network connectivity
- Verify the X-IBM-Client-Id header is correct

**4. Token Expired Too Quickly**
- The token caching has a 60-second buffer
- If tokens expire faster, check the `expires_in` value from OAuth response

