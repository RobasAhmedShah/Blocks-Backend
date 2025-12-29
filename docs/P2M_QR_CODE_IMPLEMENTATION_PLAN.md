# P2M QR Code Implementation Plan

## Overview

After completing the P2M Merchant Profile APIs, the next step is to implement **dynamic P2M QR code generation**. Unlike the static P2P QR codes currently implemented, P2M QR codes are:
- **Dynamic**: Each QR code is unique per transaction
- **Merchant-specific**: Tied to a registered merchant profile
- **Amount-specific**: Includes transaction amount
- **Trackable**: Can be linked to specific orders/transactions

## Current State

### ✅ Completed
1. **P2P QR Code** (`/api/payments/1link/1qr`)
   - Static QR code generation
   - Uses environment variables for merchant details
   - Works for wallet deposits

2. **P2M Merchant Profile APIs**
   - Create/Update/Get merchant profiles
   - Merchant profile stored in database
   - Ready for QR code generation

### 🔄 Next Steps
1. **P2M QR Code API Integration**
   - Dynamic QR code generation endpoint
   - Uses merchant profile from database
   - Includes transaction amount and reference

## Implementation Plan

### Step 1: Understand P2M QR Code Requirements

**Key Differences from P2P QR:**
- **InitiationMethod**: Should be `"12"` for dynamic QR (vs `"11"` for static)
- **MerchantAccountInformation**: Uses merchant profile data from database
- **TransactionAmount**: Required (dynamic amount per transaction)
- **ReferenceID**: Unique per transaction (order ID, invoice number, etc.)
- **MerchantID**: Must match registered merchant profile

### Step 2: Create P2M QR Code Service

**New Service Method:**
```typescript
async generateP2MQrCode(
  merchantID: string,
  amountPkr: number,
  referenceId: string,
  purpose?: string
): Promise<GenerateQrResponseDto>
```

**Flow:**
1. Fetch merchant profile from database using `merchantID`
2. Validate merchant profile exists and is active
3. Build P2M QR payload using merchant profile data
4. Call 1LINK P2M QR API
5. Return QR code image

### Step 3: Create P2M QR Code Controller Endpoint

**New Endpoint:**
```
POST /api/payments/1link/p2m/qr
```

**Request Body:**
```json
{
  "merchantID": "MERCHANT001",
  "amountPkr": 2500,
  "referenceId": "ORDER-12345",
  "purpose": "Payment for Order #12345"
}
```

**Response:**
```json
{
  "qrCodeId": "QR-1234567890-abc123",
  "referenceId": "ORDER-12345",
  "merchantID": "MERCHANT001",
  "amountPkr": "2500",
  "qrCodeBase64": "<BASE64_PNG_STRING>",
  "qrCodeDataUri": "data:image/png;base64,<BASE64_PNG_STRING>",
  "currency": "PKR",
  "expiresAt": "2025-01-12T10:30:00Z"
}
```

### Step 4: P2M QR Code Payload Structure

**Key Fields:**
```typescript
{
  InitiationMethod: "12", // Dynamic QR
  MerchantAccountInformationPayee: {
    GloballyUniqueIdentifier: merchantProfile.merchantID,
    PayeeBankIMD: merchantProfile.bankBic,
    PayeeAccountNumber: merchantProfile.iban
  },
  MerchantAccountInformationProduct: {
    GloballyUniqueIdentifier: "A00000736", // From env or merchant profile
    ProductCode: "000081" // From env or merchant profile
  },
  MCC: merchantProfile.merchantCategoryCode,
  CurrencyCode: "586", // PKR
  TransactionAmount: formattedAmount, // 12 digits, zero-padded
  CountryCode: "PK",
  MerchantName: merchantProfile.merchantName,
  MerchantCity: merchantProfile.townName || "Karachi",
  AdditionalData: {
    ReferenceID: referenceId,
    Purpose: purpose || "Payment",
    TerminalID: merchantProfile.terminalId, // If available
    BillNumber: referenceId // Can use referenceId as bill number
  }
}
```

### Step 5: Database Schema (if needed)

**Optional: QR Code Transaction Table**
```sql
CREATE TABLE p2m_qr_transactions (
  id UUID PRIMARY KEY,
  qr_code_id VARCHAR(50) UNIQUE,
  merchant_id VARCHAR(35) REFERENCES merchant_profiles(merchant_id),
  reference_id VARCHAR(100),
  amount_pkr DECIMAL(18, 2),
  currency VARCHAR(3) DEFAULT 'PKR',
  purpose TEXT,
  qr_code_base64 TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SCANNED, PAID, EXPIRED
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Step 6: Integration with Payment Flow

**Use Cases:**
1. **E-commerce Checkout**: Generate QR for order payment
2. **Invoice Payment**: Generate QR for invoice
3. **Service Payment**: Generate QR for service booking
4. **Subscription Payment**: Generate QR for recurring payment

**Flow:**
```
1. User initiates payment
2. Backend creates order/invoice
3. Backend generates P2M QR code
4. QR code displayed to user
5. User scans with banking app
6. Payment processed via 1LINK
7. Webhook notification received
8. Order/invoice marked as paid
```

## Testing Strategy

### 1. Test with Test Merchant Profile
- Use `/api/payments/1link/merchant/profile/test` to create test merchant
- Generate P2M QR code with test merchant
- Verify QR code structure

### 2. Test QR Code Scanning
- Generate QR code
- Scan with banking app
- Verify payment flow

### 3. Test Webhook Integration
- Generate QR code
- Simulate payment notification
- Verify order/invoice status update

## Environment Variables

**Add to `.env`:**
```env
# P2M QR Code Configuration
ONELINK_P2M_QR_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/qr-rest-service
ONELINK_P2M_PRODUCT_GUID=A00000736
ONELINK_P2M_PRODUCT_CODE=000081
ONELINK_P2M_QR_EXPIRY_MINUTES=30
```

## API Documentation Needed

**From 1LINK:**
- P2M QR Code API endpoint URL
- Request/response format
- Authentication requirements
- QR code expiry time
- Error codes and handling

## Next Steps

1. **Wait for P2M QR Code API Documentation**
   - User will provide the P2M QR code API documentation
   - Review payload structure
   - Understand differences from P2P QR

2. **Implement P2M QR Service**
   - Create `OneLinkP2MQrService`
   - Integrate with merchant profile service
   - Implement QR generation logic

3. **Create Controller Endpoint**
   - Add P2M QR endpoint
   - Add validation
   - Add error handling

4. **Add Database Tracking** (Optional)
   - Create QR transaction table
   - Track QR code status
   - Link to orders/invoices

5. **Test Integration**
   - Test with test merchant
   - Test QR code generation
   - Test payment flow

## Files to Create/Modify

### New Files
- `src/onelink-payments/onelink-p2m-qr.service.ts`
- `src/onelink-payments/dto/p2m-qr.dto.ts`
- `database/migrations/017_create_p2m_qr_transactions.sql` (optional)

### Modified Files
- `src/onelink-payments/onelink-payments.controller.ts` (add P2M QR endpoint)
- `src/onelink-payments/onelink-payments.module.ts` (register new service)

## Questions to Clarify

1. **QR Code Expiry**: How long should P2M QR codes be valid?
2. **Reference ID Format**: What format should reference IDs follow?
3. **Merchant Selection**: How should users select which merchant to pay?
4. **Payment Tracking**: Do we need to track QR code status?
5. **Webhook Integration**: How should payment notifications update orders/invoices?

## Ready for Implementation

Once you provide the P2M QR Code API documentation, I can:
1. ✅ Implement the P2M QR code service
2. ✅ Create the controller endpoint
3. ✅ Add database tracking (if needed)
4. ✅ Create test scripts
5. ✅ Update documentation

**Status**: ⏳ Waiting for P2M QR Code API documentation


