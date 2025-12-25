# 1LINK 1GO (RAAST P2M) - RTP Integration

This document describes the 1LINK 1GO Request to Pay (RTP) integration for P2M payments.

## Overview

The RTP integration allows merchants to send payment requests to customers' bank accounts. The customer receives a notification and can approve/reject the payment request.

### Flow

```
1. Pre-RTP (Title Fetch or Alias Inquiry)
   └── Validates customer account and returns rtpId
   
2. RTP Now/Later (Create payment request)
   └── Sends RTP to customer's bank
   
3. Status Inquiry (Check payment status)
   └── Monitor RTP acceptance/rejection
   
4. Cancellation (Optional)
   └── Cancel pending RTP request
```

## Endpoints

### Base URL
```
/api/payments/1link/rtp
```

All endpoints require JWT authentication.

---

## 1. Pre-RTP Title Fetch

Validate an IBAN and get account title with rtpId for subsequent RTP requests.

**Endpoint:** `POST /api/payments/1link/rtp/title-fetch`

**Request Body:**
```json
{
  "iban": "PK36SCBL0000001123456702",
  "bankBic": "SCBLPKKA"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `iban` | string | Yes | Customer's IBAN (max 24 chars) |
| `bankBic` | string | Yes | Bank BIC/memberid (max 24 chars) |

**Response:**
```json
{
  "success": true,
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "data": {
    "rtpId": "RTP-123456789",
    "accountTitle": "MUHAMMAD AHMAD",
    "iban": "PK36SCBL0000001123456702",
    "transactionId": "uuid-here"
  }
}
```

---

## 2. Pre-RTP Alias Inquiry

Validate a mobile number (RAAST ID) and get account details with rtpId.

**Endpoint:** `POST /api/payments/1link/rtp/alias-inquiry`

**Request Body:**
```json
{
  "mobileNumber": "03001234567"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mobileNumber` | string | Yes | Customer's mobile number (11 digits) |

**Response:**
```json
{
  "success": true,
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "data": {
    "rtpId": "RTP-123456789",
    "accountTitle": "MUHAMMAD AHMAD",
    "iban": "PK36SCBL0000001123456702",
    "transactionId": "uuid-here"
  }
}
```

---

## 3. RTP Now (Immediate Request)

### 3.1 RTP Now - Merchant

**Endpoint:** `POST /api/payments/1link/rtp/now/merchant`

**Request Body:**
```json
{
  "amountPkr": 5000,
  "rtpId": "RTP-123456789",
  "billNo": "INV-001",
  "expiryMinutes": 30
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amountPkr` | number | Yes | Amount in PKR (1 - 10,000,000) |
| `rtpId` | string | Yes | RTP ID from pre-RTP call |
| `billNo` | string | No | Bill/Invoice number (max 35 chars) |
| `expiryMinutes` | number | No | Expiry time in minutes (default: 30) |

**Response:**
```json
{
  "success": true,
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "data": {
    "rtpId": "RTP-123456789",
    "transactionId": "uuid-here",
    "displayCode": "RTP-ABC123",
    "amount": 5000,
    "currency": "PKR",
    "status": "SENT",
    "expiryDateTime": "2024-01-15T14:30:00.000Z"
  }
}
```

### 3.2 RTP Now - Aggregator

**Endpoint:** `POST /api/payments/1link/rtp/now/aggregator`

Same request/response as Merchant mode.

---

## 4. RTP Later (Scheduled Request)

### 4.1 RTP Later - Merchant

**Endpoint:** `POST /api/payments/1link/rtp/later/merchant`

**Request Body:**
```json
{
  "amountPkr": 5000,
  "rtpId": "RTP-123456789",
  "billNo": "INV-001",
  "expiryMinutes": 1440,
  "executionDateTime": "2024-01-15T14:30:00"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amountPkr` | number | Yes | Amount in PKR |
| `rtpId` | string | Yes | RTP ID from pre-RTP call |
| `billNo` | string | No | Bill/Invoice number |
| `expiryMinutes` | number | No | Expiry time (default: 1440 = 24 hours) |
| `executionDateTime` | string | No | Scheduled execution time (ISO format) |

### 4.2 RTP Later - Aggregator

**Endpoint:** `POST /api/payments/1link/rtp/later/aggregator`

**Additional Required Field:**
```json
{
  "transactionType": "001"
}
```

---

## 5. Status Inquiry

Check the status of an RTP request.

**Endpoint:** `POST /api/payments/1link/rtp/status`

**Request Body:**
```json
{
  "rtpId": "RTP-123456789"
}
```

**Response:**
```json
{
  "success": true,
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "data": {
    "rtpId": "RTP-123456789",
    "transactionId": "uuid-here",
    "rtpStatus": "ACCP"
  }
}
```

### RTP Status Codes

| Code | Meaning |
|------|---------|
| `ACCP` | Accepted by customer |
| `RJCT` | Rejected by customer |
| `PDNG` | Pending (waiting for customer) |
| `ACTC` | Sent to customer's bank |
| `ACSC` | Settlement completed |
| `CANC` | Cancelled by merchant |

---

## 6. RTP Cancellation

Cancel a pending RTP request.

**Endpoint:** `POST /api/payments/1link/rtp/cancel`

**Request Body:**
```json
{
  "rtpId": "RTP-123456789"
}
```

**Response:**
```json
{
  "success": false,
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "data": {
    "rtpId": "RTP-123456789",
    "transactionId": "uuid-here",
    "cancelled": true
  }
}
```

---

## 7. Get User Transactions

Get RTP transaction history for the authenticated user.

**Endpoint:** `GET /api/payments/1link/rtp/transactions`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max transactions to return (default: 50) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "displayCode": "RTP-ABC123",
      "operationType": "RTP_NOW_MERCHANT",
      "rtpId": "RTP-123456789",
      "amount": 5000,
      "currency": "PKR",
      "status": "SENT",
      "payerTitle": "MUHAMMAD AHMAD",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "expiryDateTime": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

## 8. Get Transaction by RTP ID

**Endpoint:** `GET /api/payments/1link/rtp/transactions/:rtpId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "displayCode": "RTP-ABC123",
    "operationType": "RTP_NOW_MERCHANT",
    "rtpId": "RTP-123456789",
    "stan": "123456",
    "rrn": "123456789012",
    "amount": 5000,
    "currency": "PKR",
    "status": "SENT",
    "responseCode": "00",
    "responseDescription": "Processed OK",
    "payerTitle": "MUHAMMAD AHMAD",
    "payerIban": "PK36SCBL0000001123456702",
    "billNo": "INV-001",
    "expiryDateTime": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

## Environment Variables

Add these to your `.env` file:

```env
# 1LINK RTP API Configuration
ONELINK_RTP_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link

# Merchant Configuration for RTP
ONELINK_RTP_MERCHANT_ID=BLOCKS001
ONELINK_MERCHANT_IBAN=PK36SCBL0000001123456702
ONELINK_BANK_BIC=SCBLPKKA
ONELINK_DBA_NAME=Blocks Digital
ONELINK_MERCHANT_ADDRESS=DHA Phase 6
ONELINK_TERMINAL_ID=0001
ONELINK_CHANNEL_ID=BLOCKS
ONELINK_MERCHANT_EMAIL=support@blocks.pk
ONELINK_MERCHANT_MOBILE=03001234567
```

### Complete Environment Variables (1LINK)

```env
# 1LINK Sandbox Credentials
ONELINK_CLIENT_ID=3fbc282ce1f63e22297a8e4ce10b6aca
ONELINK_CLIENT_SECRET=dab7c9ebda0046ea07b0d8e705d56ff7
ONELINK_OAUTH_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/oauth2/token
ONELINK_IBM_CLIENT_ID=3fbc282ce1f63e22297a8e4ce10b6aca

# 1QR API
ONELINK_QR_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/qr-rest-service

# RTP API
ONELINK_RTP_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link

# Merchant Configuration
ONELINK_MERCHANT_NAME=Blocks
ONELINK_MERCHANT_CITY=Karachi
ONELINK_MCC=0010
ONELINK_PAYEE_GUID=A000000736
ONELINK_PAYEE_BANK_IMD=435345
ONELINK_PAYEE_ACCOUNT_NUMBER=IBAN220011194544555666
ONELINK_PRODUCT_GUID=A00000736
ONELINK_PRODUCT_CODE=000081

# RTP Merchant Configuration
ONELINK_RTP_MERCHANT_ID=BLOCKS001
ONELINK_MERCHANT_IBAN=PK36SCBL0000001123456702
ONELINK_BANK_BIC=SCBLPKKA
ONELINK_DBA_NAME=Blocks Digital
ONELINK_MERCHANT_ADDRESS=DHA Phase 6
ONELINK_TERMINAL_ID=0001
ONELINK_CHANNEL_ID=BLOCKS
ONELINK_MERCHANT_EMAIL=support@blocks.pk
ONELINK_MERCHANT_MOBILE=03001234567
```

---

## Database Migration

Run the migration to create the RTP transactions table:

```bash
npm run migrate
```

Or manually run:
```sql
-- See: database/migrations/015_create_rtp_transactions.sql
```

---

## Testing with cURL

### 1. Pre-RTP Title Fetch

```bash
curl -X POST http://localhost:3000/api/payments/1link/rtp/title-fetch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "iban": "PK36SCBL0000001123456702",
    "bankBic": "SCBLPKKA"
  }'
```

### 2. Pre-RTP Alias Inquiry

```bash
curl -X POST http://localhost:3000/api/payments/1link/rtp/alias-inquiry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "mobileNumber": "03001234567"
  }'
```

### 3. RTP Now Merchant

```bash
curl -X POST http://localhost:3000/api/payments/1link/rtp/now/merchant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "amountPkr": 5000,
    "rtpId": "RTP-ID-FROM-PRE-RTP",
    "billNo": "INV-001"
  }'
```

### 4. Status Inquiry

```bash
curl -X POST http://localhost:3000/api/payments/1link/rtp/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "rtpId": "RTP-ID-TO-CHECK"
  }'
```

### 5. Cancellation

```bash
curl -X POST http://localhost:3000/api/payments/1link/rtp/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "rtpId": "RTP-ID-TO-CANCEL"
  }'
```

### 6. Get Transactions

```bash
curl -X GET "http://localhost:3000/api/payments/1link/rtp/transactions?limit=10" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## Error Handling

### Response Codes

| Code | Description |
|------|-------------|
| `00` | Success |
| `01` | Invalid format |
| `02` | Invalid IBAN |
| `03` | Account not found |
| `04` | RTP ID expired |
| `05` | RTP already processed |
| `10` | System error |

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid JWT) |
| 500 | Internal Server Error |

---

## Typical Integration Flow

### For Wallet Deposits via RTP

```
1. User enters customer's mobile number or IBAN
   └── Frontend calls alias-inquiry or title-fetch
   
2. Backend returns rtpId + account title
   └── Frontend shows account title for confirmation
   
3. User enters amount and confirms
   └── Frontend calls rtp/now/merchant with rtpId
   
4. Customer receives push notification from their bank
   └── Customer approves/rejects in their bank app
   
5. Backend polls status-inquiry (or receives webhook)
   └── Update transaction status
   
6. On successful payment, credit user's wallet
```

### For Bill Payment

```
1. Generate bill with unique billNo
   └── Store pending payment in database

2. When customer scans QR or receives link
   └── Fetch customer account via title-fetch

3. Create RTP request with billNo
   └── Call rtp/now/merchant

4. Monitor status until ACCP or RJCT
   └── Poll status-inquiry or use webhook

5. Mark bill as paid on ACCP
```

---

## Architecture

```
┌─────────────────────┐
│    Mobile App       │
│   (Frontend)        │
└──────────┬──────────┘
           │ RTP API Calls
           ▼
┌─────────────────────┐
│ OneLinkRtpController│
│ (/api/payments/...) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ OneLinkRtpService   │────▶│ OneLinkOAuthService │
│ (RTP Logic)         │     │ (Token Management)  │
└──────────┬──────────┘     └─────────────────────┘
           │
           ├──────────────────────────┐
           ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐
│ RtpTransaction      │    │ 1LINK RTP API       │
│ (Audit Log DB)      │    │ sandboxapi.1link... │
└─────────────────────┘    └─────────────────────┘
```

---

## Postman Collection

```json
{
  "info": {
    "name": "1LINK RTP Integration",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:3000" },
    { "key": "jwtToken", "value": "YOUR_JWT_TOKEN" }
  ],
  "item": [
    {
      "name": "Pre-RTP Title Fetch",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"iban\": \"PK36SCBL0000001123456702\",\n  \"bankBic\": \"SCBLPKKA\"\n}"
        },
        "url": "{{baseUrl}}/api/payments/1link/rtp/title-fetch"
      }
    },
    {
      "name": "Pre-RTP Alias Inquiry",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"mobileNumber\": \"03001234567\"\n}"
        },
        "url": "{{baseUrl}}/api/payments/1link/rtp/alias-inquiry"
      }
    },
    {
      "name": "RTP Now - Merchant",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"amountPkr\": 5000,\n  \"rtpId\": \"RTP-ID-HERE\",\n  \"billNo\": \"INV-001\"\n}"
        },
        "url": "{{baseUrl}}/api/payments/1link/rtp/now/merchant"
      }
    },
    {
      "name": "RTP Now - Aggregator",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"amountPkr\": 5000,\n  \"rtpId\": \"RTP-ID-HERE\"\n}"
        },
        "url": "{{baseUrl}}/api/payments/1link/rtp/now/aggregator"
      }
    },
    {
      "name": "RTP Later - Merchant",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"amountPkr\": 5000,\n  \"rtpId\": \"RTP-ID-HERE\",\n  \"expiryMinutes\": 1440\n}"
        },
        "url": "{{baseUrl}}/api/payments/1link/rtp/later/merchant"
      }
    },
    {
      "name": "RTP Later - Aggregator",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"amountPkr\": 5000,\n  \"rtpId\": \"RTP-ID-HERE\",\n  \"transactionType\": \"001\"\n}"
        },
        "url": "{{baseUrl}}/api/payments/1link/rtp/later/aggregator"
      }
    },
    {
      "name": "Status Inquiry",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"rtpId\": \"RTP-ID-HERE\"\n}"
        },
        "url": "{{baseUrl}}/api/payments/1link/rtp/status"
      }
    },
    {
      "name": "RTP Cancellation",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"rtpId\": \"RTP-ID-HERE\"\n}"
        },
        "url": "{{baseUrl}}/api/payments/1link/rtp/cancel"
      }
    },
    {
      "name": "Get User Transactions",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "url": "{{baseUrl}}/api/payments/1link/rtp/transactions?limit=50"
      }
    },
    {
      "name": "Get Transaction by RTP ID",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwtToken}}" }
        ],
        "url": "{{baseUrl}}/api/payments/1link/rtp/transactions/RTP-ID-HERE"
      }
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

**1. "rtpId is required" Error**
- Run title-fetch or alias-inquiry first to get the rtpId
- The rtpId is returned from these pre-RTP calls

**2. Token Expired (401)**
- OAuth token is automatically cached and refreshed
- If 401 occurs, the system retries with a fresh token

**3. Invalid IBAN Format**
- IBAN must be exactly 24 characters
- Format: `PK` + 2 check digits + 4 bank code + 16 account number

**4. "Transaction not found"**
- Ensure the rtpId exists
- Check if you have access to this transaction (user ownership)

**5. Status stuck at PENDING**
- Customer hasn't responded yet
- Check expiry time - RTP may have expired
- Use status-inquiry to get current status

