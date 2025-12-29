# Testing P2M Merchant APIs

This guide will help you test all the P2M Merchant Profile APIs.

## Prerequisites

1. **Server Running**: Make sure your NestJS server is running
   ```bash
   npm run start:dev
   ```
   Server should be on `http://localhost:3001` (or check your PORT env variable)

2. **Database Migration**: Run the merchant profiles migration
   ```bash
   npm run migrate
   ```
   Or manually execute: `database/migrations/016_create_merchant_profiles.sql`

3. **JWT Token**: You need a valid JWT token for authenticated endpoints
   - Get one by logging in: `POST /api/mobile/auth/login`
   - Or use an existing token from your mobile app

4. **Environment Variables**: Ensure these are set in `.env`:
   ```env
   ONELINK_CLIENT_ID=3fbc282ce1f63e22297a8e4ce10b6aca
   ONELINK_CLIENT_SECRET=dab7c9ebda0046ea07b0d8e705d56ff7
   ONELINK_OAUTH_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/oauth2/token
   ONELINK_RTP_API_URL=https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link
   ```

## Quick Test with PowerShell

1. **Update the test script**:
   - Open `test-merchant-apis.ps1`
   - Replace `YOUR_JWT_TOKEN_HERE` with your actual JWT token
   - Update `BASE_URL` if your server runs on a different port

2. **Run the test**:
   ```powershell
   .\test-merchant-apis.ps1
   ```

## Manual Testing with cURL

### Step 1: Get JWT Token (if needed)

```bash
curl -X POST http://localhost:3001/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

Copy the `token` from the response.

### Step 2: Test Create Merchant Profile

```bash
curl -X POST http://localhost:3001/api/payments/1link/merchant/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "merchantDetails": {
      "dbaName": "Test Business Name",
      "merchantName": "Test Merchant",
      "iban": "PK36SCBL0000001123456702",
      "bankBic": "SCBLPK",
      "merchantCategoryCode": "0010",
      "merchantID": "TEST001",
      "accountTitle": "Test Account Title",
      "postalAddress": {
        "townName": "Karachi",
        "addressLine": "123 Test Street"
      },
      "contactDetails": {
        "phoneNo": "02112345678",
        "mobileNo": "03001234567",
        "email": "test@example.com",
        "dept": "Sales",
        "website": "https://example.com"
      },
      "paymentDetails": {
        "feeType": "F",
        "feeValue": 15
      }
    }
  }'
```

**Expected Response:**
```json
{
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "merchantProfile": {
    "id": "uuid",
    "merchantID": "TEST001",
    "dbaName": "Test Business Name",
    ...
  }
}
```

### Step 3: Test Get Merchant Profile

```bash
curl -X GET "http://localhost:3001/api/payments/1link/merchant/profile?merchantID=TEST001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 4: Test Update Merchant Profile

```bash
curl -X POST http://localhost:3001/api/payments/1link/merchant/profile/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "merchantDetails": {
      "merchantStatus": "00",
      "dbaName": "Updated Business Name",
      "merchantName": "Updated Merchant Name",
      "iban": "PK36SCBL0000001123456702",
      "bankBic": "SCBLPK",
      "merchantCategoryCode": "0010",
      "merchantID": "TEST001",
      "accountTitle": "Updated Account Title"
    }
  }'
```

### Step 5: Test List All Merchant Profiles

```bash
curl -X GET http://localhost:3001/api/payments/1link/merchant/profiles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 6: Test Create Merchant Profile V2

```bash
curl -X POST http://localhost:3001/api/payments/1link/merchant/profile/v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "merchantDetails": {
      "dbaName": "Test Business V2",
      "merchantName": "Test Merchant V2",
      "iban": "PK36SCBL0000001123456702",
      "bankBic": "SCBLPK",
      "merchantCategoryCode": "0010",
      "merchantID": "TEST002",
      "accountTitle": "Test Account V2"
    }
  }'
```

### Step 7: Test Notify Merchant (Webhook - No Auth)

```bash
curl -X POST http://localhost:3001/api/payments/1link/merchant/notify \
  -H "Content-Type: application/json" \
  -d '{
    "info": {
      "rrn": "123456789012",
      "stan": "123456",
      "dateTime": "2025-01-12T10:00:00Z"
    },
    "messageInfo": {
      "merchantID": "TEST001",
      "subDept": "Sales",
      "status": "ACCP"
    }
  }'
```

### Step 8: Test Payment Notification (Webhook - No Auth)

```bash
curl -X POST http://localhost:3001/api/payments/1link/merchant/payment-notification \
  -H "Content-Type: application/json" \
  -d '{
    "info": {
      "rrn": "123456789012",
      "stan": "123456",
      "dateTime": "2025-01-12T10:00:00Z"
    },
    "messageInfo": {
      "merchantID": "TEST001",
      "subDept": "Sales",
      "status": "ACCP",
      "orginalInstructedAmount": "1000.00",
      "netAmount": "985.00"
    }
  }'
```

## Testing with Postman/Insomnia

### Collection Setup

1. **Base URL**: `http://localhost:3001`
2. **Authorization**: Bearer Token (for authenticated endpoints)
3. **Headers**: `Content-Type: application/json`

### Endpoints to Test

1. `POST /api/payments/1link/merchant/profile` - Create Merchant Profile
2. `GET /api/payments/1link/merchant/profile?merchantID={id}` - Get Merchant Profile
3. `POST /api/payments/1link/merchant/profile/update` - Update Merchant Profile
4. `GET /api/payments/1link/merchant/profiles` - List All Merchant Profiles
5. `POST /api/payments/1link/merchant/profile/v2` - Create Merchant Profile V2
6. `POST /api/payments/1link/merchant/notify` - Notify Merchant (no auth)
7. `POST /api/payments/1link/merchant/payment-notification` - Payment Notification (no auth)

## Expected Results

### Success Responses

All merchant profile operations should return:
```json
{
  "responseCode": "00",
  "responseDescription": "Processed OK",
  "merchantProfile": { ... }
}
```

Webhook endpoints return:
```json
{
  "success": true,
  "message": "Notification received and processed"
}
```

### Error Responses

- **400 Bad Request**: Validation error (check field lengths, required fields)
- **401 Unauthorized**: Missing or invalid JWT token
- **404 Not Found**: Merchant profile not found (for update/get)
- **500 Internal Server Error**: 1LINK API error or server error

## Common Issues

### Issue: "1LINK OAuth credentials not configured"
**Solution**: Check your `.env` file has `ONELINK_CLIENT_ID`, `ONELINK_CLIENT_SECRET`, and `ONELINK_OAUTH_URL`

### Issue: "Merchant profile already exists"
**Solution**: Use a different `merchantID` or delete the existing profile from database

### Issue: "401 Unauthorized"
**Solution**: 
- Get a fresh JWT token from login endpoint
- Make sure token is not expired
- Check token format: `Bearer <token>`

### Issue: "404 Not Found" on Get/Update
**Solution**: Create the merchant profile first using the Create endpoint

### Issue: "1LINK API error"
**Solution**: 
- Check 1LINK sandbox is accessible
- Verify OAuth token is being fetched correctly
- Check server logs for detailed error messages

## Verification Checklist

- [ ] Server is running on correct port
- [ ] Database migration executed
- [ ] Environment variables configured
- [ ] JWT token obtained
- [ ] Create Merchant Profile works
- [ ] Get Merchant Profile works
- [ ] Update Merchant Profile works
- [ ] List Merchant Profiles works
- [ ] Create Merchant Profile V2 works
- [ ] Notify Merchant webhook works (no auth)
- [ ] Payment Notification webhook works (no auth)
- [ ] Database records created correctly
- [ ] 1LINK API responses logged

## Next Steps

After successful testing:
1. Configure webhook URLs in 1LINK merchant dashboard
2. Test with real merchant accounts
3. Implement dynamic P2M QR code generation (next phase)


