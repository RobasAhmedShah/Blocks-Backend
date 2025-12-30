# Testing Gmail Watch Flow - Step by Step Guide

## Prerequisites

✅ Gmail watch is enabled (expires in 7 days)  
✅ Pub/Sub push subscription is created  
✅ Webhook endpoint is accessible  
✅ Database has `gmail_sync` table  
✅ User has `bankAccountLast4` set  

## Test Flow

### Step 1: Verify Gmail Watch is Active

```bash
curl -X POST http://localhost:3001/api/gmail/watch/renew \
  -H "Content-Type: application/json" \
  -d "{}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Gmail watch started/renewed successfully",
  "expiration": "2026-01-06T12:27:47.904Z",
  "historyId": "1629324"
}
```

### Step 2: Set Up Test User

Make sure you have a user with `bankAccountLast4` set:

```sql
-- Check existing users
SELECT id, email, "bankAccountLast4" 
FROM users 
WHERE "bankAccountLast4" IS NOT NULL;

-- Or set it for a test user
UPDATE users 
SET "bankAccountLast4" = '0018' 
WHERE email = 'test@example.com';
```

### Step 3: Send Test Email

Send an email to your watched Gmail inbox (`robasahmedshah@gmail.com`) with:

**From:** Any email (bank filter is disabled for testing)  
**Subject:** Test Transaction  
**Body:** Should contain:
- Amount: `PKR 2,100.00` or `Rs. 2,100.00`
- Account: `***0018` (matching your test user's `bankAccountLast4`)
- Transaction Reference: Any unique ID

**Example Email Body:**
```
Transaction Alert

Amount: PKR 2,100.00
Account: ***0018
Reference: TEST123456
```

### Step 4: Monitor Backend Logs

Watch your backend console for these logs:

**When Pub/Sub sends event:**
```
📩 Gmail Push Received: {...}
✅ Gmail event received: { emailAddress: '...', historyId: '...' }
```

**When email is fetched:**
```
📧 Email received - From: [sender], Subject: Test Transaction
⚠️  Bank filter DISABLED for testing - processing all emails
```

**When transaction is parsed:**
```
💰 Transaction parsed: PKR 2100, Account: ***0018, Reference: TEST123456
```

**When user is matched:**
```
✅ Matched user: test@example.com (USR-000001)
```

**When wallet is credited:**
```
✅ Credited PKR 2100 to user USR-000001 from bank email
```

### Step 5: Verify Wallet Credit

Check the user's wallet:

```sql
SELECT 
  u.email,
  u."bankAccountLast4",
  w."balanceUSDT",
  w."totalDepositedUSDT",
  t.amount,
  t."referenceId",
  t.created_at
FROM users u
JOIN wallets w ON w."userId" = u.id
LEFT JOIN transactions t ON t."userId" = u.id 
  AND t.type = 'deposit' 
  AND t."referenceId" LIKE 'GMAIL-%'
WHERE u.email = 'test@example.com'
ORDER BY t.created_at DESC
LIMIT 5;
```

### Step 6: Check Gmail Sync Status

```sql
SELECT * FROM gmail_sync;
```

Should show the last processed `historyId`.

## Troubleshooting

### "No user found with account last 4"
- Set `bankAccountLast4` for the user
- Verify the email contains account number in `***XXXX` format

### "Multiple users found"
- Each `bankAccountLast4` should map to exactly one user
- Update duplicate users to have unique account numbers

### "Transaction already processed"
- This is idempotency working correctly
- The transaction was already credited (check wallet)

### Webhook not receiving events
- Verify Pub/Sub subscription push endpoint is correct
- Check subscription is active in Google Cloud Console
- Verify Gmail watch is still active (check expiration)
- Test webhook manually: `node scripts/test-pubsub-gmail.js`

### Email not being processed
- Check if bank filter is enabled (`ENABLE_BANK_FILTER=true`)
- Verify email format matches expected patterns
- Check logs for parsing errors

## Testing Locally

If testing locally, you need to expose your endpoint:

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   # or download from ngrok.com
   ```

2. **Start tunnel:**
   ```bash
   ngrok http 3001
   ```

3. **Update Pub/Sub subscription:**
   - Go to Google Cloud Console
   - Update push endpoint to: `https://abc123.ngrok.io/api/pubsub/gmail`

4. **Send test email** and watch logs

## Expected Timeline

1. **Email sent** → Gmail receives (instant)
2. **Gmail watch** → Detects new email (within seconds)
3. **Pub/Sub** → Pushes to webhook (within seconds)
4. **Backend** → Processes email (within seconds)
5. **Wallet** → Credited (instant)

**Total time: 5-30 seconds from email sent to wallet credited**

## Success Criteria

✅ Email received in Gmail inbox  
✅ Pub/Sub webhook triggered (`📩 Gmail Push Received`)  
✅ Email parsed successfully (`💰 Transaction parsed`)  
✅ User matched (`✅ Matched user`)  
✅ Wallet credited (`✅ Credited PKR X`)  
✅ Transaction created in database  
✅ No duplicate transactions (idempotency working)  

