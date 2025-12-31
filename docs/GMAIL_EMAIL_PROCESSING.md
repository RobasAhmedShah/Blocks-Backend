# Gmail Email Processing - Bank Deposit Automation

## Overview

This system automatically processes bank deposit emails from Gmail, extracts transaction details, matches users by bank account, and credits their wallets.

## Architecture

```
Gmail Watch → Pub/Sub → Webhook → Fetch History → Get Emails → Parse → Match User → Credit Wallet
```

## Flow

1. **Gmail Watch**: Gmail sends history events to Pub/Sub
2. **Pub/Sub Webhook**: `/api/pubsub/gmail` receives the event
3. **Fetch History**: Backend fetches Gmail history from last processed ID
4. **Get Emails**: Backend retrieves full email messages
5. **Parse**: Extract amount, account last 4, transaction reference
6. **Match User**: Find user by `bankAccountLast4`
7. **Credit Wallet**: Deposit funds to user's wallet

## Environment Variables

Add these to your `.env` file:

```env
# Gmail API Configuration
# Paste the entire service account JSON as a single-line string
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"blocks-1b5ba","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"blocks-pubsub-listener-914@blocks-1b5ba.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"...","universe_domain":"googleapis.com"}'
GMAIL_WATCHED_EMAIL=robasahmedshah@gmail.com
GMAIL_PUBSUB_TOPIC=projects/blocks-1b5ba/topics/gmail-events
```

**Required Environment Variables:**
- `GOOGLE_SERVICE_ACCOUNT_JSON`: Full service account JSON (single-line string)
- `GMAIL_WATCHED_EMAIL`: The Gmail address to watch for emails
- `GMAIL_PUBSUB_TOPIC`: Pub/Sub topic where Gmail will send events (format: `projects/{project-id}/topics/{topic-name}`)

**Important Security Notes:**
- ✅ **NEVER commit `.env` to git** (already in `.gitignore`)
- ✅ Keep service account JSON as a **single-line string** in `.env`
- ✅ The `\n` in private_key will be automatically converted to newlines

## Gmail Watch Setup

Before Gmail can send events to Pub/Sub, you need to start a Gmail watch. Gmail watches expire after 7 days, so you need to renew them periodically.

### Starting/Renewing Gmail Watch

**Endpoint**: `POST /api/gmail/watch/renew`

**Authentication**: Required (uses your app's authentication)

**Request**:
```bash
curl -X POST http://localhost:3000/api/gmail/watch/renew \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Gmail watch started/renewed successfully",
  "expiration": "2025-02-03T10:00:00.000Z",
  "historyId": "123456789"
}
```

**Error Response** (200):
```json
{
  "success": false,
  "message": "Failed to start/renew Gmail watch",
  "error": "GMAIL_PUBSUB_TOPIC not configured"
}
```

### Setting Up Automatic Renewal

Since Gmail watches expire after 7 days, you should set up automatic renewal:

1. **Cron Job** (Recommended): Set up a cron job to call `/api/gmail/watch/renew` every 6 days
2. **Vercel Cron**: If using Vercel, add a cron job in `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/gmail/watch/renew",
       "schedule": "0 0 */6 * *"
     }]
   }
   ```

### For Vercel Production Deployment

**You MUST add these as Environment Variables in Vercel:**

1. Go to your Vercel project dashboard
2. Go to **Settings** → **Environment Variables**
3. Add all three environment variables:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`
   - `GMAIL_WATCHED_EMAIL`
   - `GMAIL_PUBSUB_TOPIC`
3. Add these two variables:

   ```
   GOOGLE_SERVICE_ACCOUNT_JSON = (paste the entire JSON as single-line string)
   GMAIL_WATCHED_EMAIL = robasahmedshah@gmail.com
   ```

4. **Important**: For `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the entire JSON object as a single-line string (same format as in `.env`)

5. Deploy your app - Vercel will inject these environment variables at runtime

**The service reads from `process.env.GOOGLE_SERVICE_ACCOUNT_JSON`**, which works both:
- ✅ Locally (from `.env` file)
- ✅ On Vercel (from Environment Variables in dashboard)

### Getting Service Account Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **IAM & Admin** → **Service Accounts**
4. Create or select a service account
5. Create a **JSON key** and download it
6. Copy the entire JSON content to `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env` (as a single-line string)

### Gmail API Setup

1. Enable **Gmail API** in Google Cloud Console
2. Grant the service account **Gmail Read** scope
3. Enable **Domain-Wide Delegation** if needed
4. Grant the service account access to the Gmail inbox

## Database Schema

### New Fields

**users table:**
- `bankAccountLast4` (VARCHAR(4)) - Last 4 digits of bank account for matching

**New table: gmail_sync**
- `emailAddress` (VARCHAR(255), PK) - Watched email address
- `lastHistoryId` (VARCHAR(50)) - Last processed Gmail history ID
- `createdAt`, `updatedAt` - Timestamps

## Email Classification

The system only processes emails that:

✅ **From**: `myABL@abl.com` (Allied Bank)  
✅ **Type**: Credit/Deposit (not debit)  
❌ **Ignore**: Emails with "sent from your account" or "debit" in subject

## Transaction Parsing

The system extracts:

- **Amount**: `PKR 2,100.00` or `Rs. 2,100.00` format
- **Account Last 4**: `***0018` format
- **Transaction Reference**: For idempotency (prevents double-crediting)

## User Matching

Users are matched by `bankAccountLast4`:

- ✅ **1 user found**: Credit wallet
- ❌ **0 users found**: Log warning, skip
- ❌ **>1 users found**: Log error, skip (ambiguous)

## Idempotency

Duplicate transactions are prevented by checking `transactions.referenceId`. If a transaction with the same reference already exists, it's skipped.

## Testing

### Step 1: Run Migration

```bash
npm run migrate
```

### Step 2: Set User Bank Account

```sql
UPDATE users 
SET "bankAccountLast4" = '0018' 
WHERE email = 'user@example.com';
```

### Step 3: Send Test Email

Send a deposit email from Allied Bank to the watched Gmail inbox.

### Step 4: Check Logs

Watch your backend console for:

```
✅ Gmail event received: { emailAddress: '...', historyId: '...' }
📧 Email received - From: myABL@abl.com, Subject: ...
💰 Transaction parsed: PKR 2100, Account: ***0018
✅ Matched user: user@example.com (USR-000001)
✅ Credited PKR 2100 to user USR-000001 from bank email
```

### Step 5: Verify Wallet

Check the user's wallet balance:

```sql
SELECT "balanceUSDT", "totalDepositedUSDT" 
FROM wallets 
WHERE "userId" = (SELECT id FROM users WHERE email = 'user@example.com');
```

## Troubleshooting

### "Gmail API not initialized"

- Check `GOOGLE_SERVICE_ACCOUNT_JSON` is set
- Verify JSON is valid (single-line, escaped)
- Check service account has Gmail API access

### "No user found with account last 4"

- Set `bankAccountLast4` on user record
- Verify the email contains the account number in `***XXXX` format

### "Failed to parse transaction"

- Check email format matches expected patterns
- Verify amount and account number are present
- Check logs for extracted email body

### "Multiple users found"

- Each account last 4 should map to exactly one user
- Update duplicate users to have unique account numbers

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Update Pub/Sub subscription to point to production URL
3. ✅ Set `bankAccountLast4` for all users
4. ✅ Test with real bank emails
5. ✅ Monitor logs for processing errors

