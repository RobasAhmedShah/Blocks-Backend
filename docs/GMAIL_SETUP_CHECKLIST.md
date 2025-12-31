# Gmail Email Processing - Setup Checklist

## ✅ Completed Steps

- [x] Database migrations run (`gmail_sync` table created)
- [x] Gmail watch endpoint created (`/api/gmail/watch/renew`)
- [x] Gmail watch started successfully
- [x] Pub/Sub push subscription created

## 🔍 Verification Steps

### 1. Verify Webhook Endpoint is Accessible

**If deployed to production:**
```bash
# Test the endpoint
curl -X POST https://your-domain.com/api/pubsub/gmail \
  -H "Content-Type: application/json" \
  -d '{"message":{"data":"eyJlbWFpbEFkZHJlc3MiOiJ0ZXN0QGdtYWlsLmNvbSIsImhpc3RvcnlJZCI6IjEyMzQ1NiJ9"}}'
```

**If testing locally:**
1. Install ngrok: `npm install -g ngrok` or download from ngrok.com
2. Start tunnel: `ngrok http 3001`
3. Update Pub/Sub subscription push endpoint to: `https://abc123.ngrok.io/api/pubsub/gmail`

### 2. Set Up User Bank Account Data

For each user who will receive deposits, set their `bankAccountLast4`:

```sql
-- Example: Set bank account last 4 digits for a user
UPDATE users 
SET "bankAccountLast4" = '0018' 
WHERE email = 'user@example.com';

-- Verify it's set
SELECT id, email, "bankAccountLast4" 
FROM users 
WHERE "bankAccountLast4" IS NOT NULL;
```

### 3. Test the Full Flow

**Option A: Send Real Test Email**
1. Send an email from Allied Bank (`myABL@abl.com`) to your watched Gmail inbox
2. The email should contain:
   - Amount (e.g., "PKR 2,100.00" or "Rs. 2,100.00")
   - Account last 4 digits (e.g., "***0018")
   - Transaction reference

**Option B: Simulate Pub/Sub Message**
Use the test script:
```bash
node scripts/test-pubsub-gmail.js
```

### 4. Monitor Backend Logs

Watch for these log messages:

**When Pub/Sub sends event:**
```
📩 Gmail Push Received: {...}
✅ Gmail event received: { emailAddress: '...', historyId: '...' }
```

**When email is fetched:**
```
📧 Email received - From: myABL@abl.com, Subject: ...
```

**When transaction is parsed:**
```
💰 Transaction parsed: PKR 2100, Account: ***0018, Reference: ABC123
```

**When user is matched:**
```
✅ Matched user: user@example.com (USR-000001)
```

**When wallet is credited:**
```
✅ Credited PKR 2100 to user USR-000001 from bank email
```

### 5. Verify Wallet Credit

Check the user's wallet balance:

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
LEFT JOIN transactions t ON t."userId" = u.id AND t.type = 'deposit'
WHERE u.email = 'user@example.com'
ORDER BY t.created_at DESC;
```

## 🔄 Maintenance Tasks

### Set Up Automatic Watch Renewal

Gmail watches expire after 7 days. Set up automatic renewal:

**Option A: Vercel Cron (Recommended)**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/gmail/watch/renew",
    "schedule": "0 0 */6 * *"
  }]
}
```

**Option B: External Cron Service**
Use cron-job.org or similar to call:
```
POST https://your-domain.com/api/gmail/watch/renew
```
Schedule: Every 6 days

**Option C: Manual Renewal**
Remember to call the endpoint every 6 days:
```bash
curl -X POST https://your-domain.com/api/gmail/watch/renew \
  -H "Content-Type: application/json" \
  -d "{}"
```

## 🐛 Troubleshooting

### "No user found with account last 4"
- Set `bankAccountLast4` for the user in database
- Verify the email contains account number in `***XXXX` format

### "Multiple users found"
- Each `bankAccountLast4` should map to exactly one user
- Update duplicate users to have unique account numbers

### "Failed to parse transaction"
- Check email format matches expected patterns
- Verify amount and account number are present
- Check logs for extracted email body

### "Gmail API not initialized"
- Check `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` are set
- Or check `GOOGLE_SERVICE_ACCOUNT_JSON` and `GMAIL_WATCHED_EMAIL` are set
- Verify OAuth2 refresh token is valid

### Webhook not receiving events
- Verify Pub/Sub subscription push endpoint is correct
- Check subscription is active in Google Cloud Console
- Verify Gmail watch is still active (check expiration date)
- Test webhook endpoint manually with test script

## 📊 Monitoring

### Check Gmail Sync Status
```sql
SELECT * FROM gmail_sync;
```

### Check Recent Transactions
```sql
SELECT 
  t.*,
  u.email,
  u."bankAccountLast4"
FROM transactions t
JOIN users u ON u.id = t."userId"
WHERE t.type = 'deposit'
  AND t."referenceId" LIKE 'GMAIL-%'
ORDER BY t.created_at DESC
LIMIT 10;
```

### Check Watch Expiration
Call the watch renewal endpoint to see expiration:
```bash
curl -X POST http://localhost:3001/api/gmail/watch/renew \
  -H "Content-Type: application/json" \
  -d "{}"
```

Look for `expiration` field in response.

