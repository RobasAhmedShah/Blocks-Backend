# Gmail Webhook Endpoint URL Setup

## Endpoint Path

Your webhook endpoint is:
```
/api/pubsub/gmail
```

## For Local Testing (Development)

### Step 1: Start ngrok

**Open a NEW terminal window** and run:

```bash
ngrok http 3001
```

(Use port 3001 if that's what your backend runs on, or 3000 if different)

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3001
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Step 2: Set Pub/Sub Subscription Push Endpoint

In Google Cloud Console:

1. Go to **Pub/Sub → Subscriptions**
2. Click on your subscription (e.g., `gmail-deposit-push-sub`)
3. Click **Edit** (pencil icon)
4. Under **Delivery type**, select **Push**
5. In **Endpoint URL**, enter:
   ```
   https://abc123.ngrok.io/api/pubsub/gmail
   ```
   (Replace `abc123.ngrok.io` with your actual ngrok URL)
6. Click **Update**

### Step 3: Verify Endpoint is Accessible

Test the endpoint manually:

```bash
curl -X POST https://abc123.ngrok.io/api/pubsub/gmail \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

You should see logs in your backend:
```
📩 ========== GMAIL WEBHOOK HIT ==========
```

## For Production (Vercel/Deployed)

### Step 1: Get Your Production URL

Your production URL is typically:
- Vercel: `https://your-app.vercel.app`
- Custom domain: `https://your-domain.com`

### Step 2: Set Pub/Sub Subscription Push Endpoint

In Google Cloud Console:

1. Go to **Pub/Sub → Subscriptions**
2. Click on your subscription
3. Click **Edit**
4. Under **Delivery type**, select **Push**
5. In **Endpoint URL**, enter:
   ```
   https://your-app.vercel.app/api/pubsub/gmail
   ```
   (Replace with your actual production URL)
6. Click **Update**

## Important Notes

### ✅ Requirements

1. **Must be HTTPS** (not HTTP)
   - ❌ `http://localhost:3001/api/pubsub/gmail` (won't work)
   - ✅ `https://abc123.ngrok.io/api/pubsub/gmail` (works)

2. **Must be publicly accessible**
   - ❌ `localhost` (won't work - Pub/Sub can't reach it)
   - ✅ ngrok URL or production URL (works)

3. **Must include full path**
   - ✅ `https://abc123.ngrok.io/api/pubsub/gmail` (correct)
   - ❌ `https://abc123.ngrok.io` (missing path)

4. **No trailing slash**
   - ✅ `https://abc123.ngrok.io/api/pubsub/gmail` (correct)
   - ❌ `https://abc123.ngrok.io/api/pubsub/gmail/` (trailing slash)

### 🔍 Verify Subscription Configuration

In Google Cloud Console:

1. Go to **Pub/Sub → Subscriptions**
2. Click on your subscription
3. Check:
   - ✅ **Delivery type**: Push
   - ✅ **Endpoint URL**: `https://your-url/api/pubsub/gmail`
   - ✅ **Status**: Active
   - ✅ **Topic**: `projects/blocks-1b5ba/topics/gmail-deposit-events`

### 🧪 Test Webhook Manually

Test if webhook works:

```bash
# Create test message
node scripts/test-pubsub-gmail.js
```

Or use curl:

```bash
# Create test Gmail event
MESSAGE='{"emailAddress":"test@gmail.com","historyId":"123456789"}'
BASE64=$(echo -n "$MESSAGE" | base64)

curl -X POST https://your-url/api/pubsub/gmail \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"data\": \"$BASE64\",
      \"messageId\": \"test-123\",
      \"publishTime\": \"2025-01-27T10:00:00.000Z\"
    },
    \"subscription\": \"projects/blocks-1b5ba/subscriptions/gmail-deposit-push-sub\"
  }"
```

## Common Issues

### Issue 1: Webhook Not Being Hit

**Symptoms:**
- No logs showing `📩 ========== GMAIL WEBHOOK HIT ==========`
- Emails arrive but nothing happens

**Solutions:**
1. ✅ Check endpoint URL is correct in Pub/Sub subscription
2. ✅ Verify endpoint is HTTPS (not HTTP)
3. ✅ Test endpoint manually with curl
4. ✅ Check Pub/Sub subscription delivery logs in Google Cloud Console
5. ✅ If local: Make sure ngrok is running

### Issue 2: ngrok URL Changes

**Problem:** ngrok free tier gives you a new URL each time you restart

**Solutions:**
1. Keep ngrok running (don't restart it)
2. Update Pub/Sub subscription URL each time ngrok restarts
3. Use ngrok static domain (paid feature)

### Issue 3: 404 Not Found

**Problem:** Endpoint returns 404

**Solutions:**
1. ✅ Check path is exactly: `/api/pubsub/gmail`
2. ✅ No trailing slash
3. ✅ Backend is running
4. ✅ Route is registered (check controller)

## Quick Checklist

- [ ] Endpoint path: `/api/pubsub/gmail`
- [ ] Full URL: `https://your-url/api/pubsub/gmail`
- [ ] HTTPS (not HTTP)
- [ ] Publicly accessible (not localhost)
- [ ] No trailing slash
- [ ] Backend is running
- [ ] Pub/Sub subscription is active
- [ ] Test endpoint manually (should see logs)

