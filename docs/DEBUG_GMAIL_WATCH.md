# Debugging Gmail Watch - Why Webhook Isn't Being Called

## Problem
Gmail watch is active, but webhook (`/api/pubsub/gmail`) is not receiving events when new emails arrive.

## Diagnostic Steps

### Step 1: Check if Webhook is Being Hit

**Watch your backend logs.** When a new email arrives, you should see:
```
📩 ========== GMAIL WEBHOOK HIT ==========
```

**If you DON'T see this:**
- The webhook is NOT being called by Pub/Sub
- Problem is in Pub/Sub configuration, not your code

**If you DO see this:**
- The webhook IS being called
- Problem is in message processing

### Step 2: Verify Pub/Sub Subscription Configuration

Check in Google Cloud Console:

1. **Go to Pub/Sub → Subscriptions**
2. **Find your subscription** (e.g., `gmail-deposit-push-sub`)
3. **Check these settings:**

   ✅ **Push endpoint URL:**
   - If local: `https://abc123.ngrok.io/api/pubsub/gmail`
   - If production: `https://your-domain.com/api/pubsub/gmail`
   
   ✅ **Endpoint is accessible:**
   - Must return 200 OK
   - Must be HTTPS (not HTTP)
   - Must be publicly accessible

   ✅ **Subscription is ACTIVE:**
   - Status should be "Active"
   - Not paused or deleted

   ✅ **Topic is correct:**
   - Should match: `projects/blocks-1b5ba/topics/gmail-deposit-events`

### Step 3: Verify Gmail Watch is Active

```bash
curl -X POST http://localhost:3001/api/gmail/watch/renew \
  -H "Content-Type: application/json" \
  -d "{}"
```

**Check response:**
- `expiration` should be ~7 days from now
- `historyId` should be current

### Step 4: Test Webhook Manually

Test if webhook endpoint works:

```bash
node scripts/test-pubsub-gmail.js
```

**Expected logs:**
```
📩 ========== GMAIL WEBHOOK HIT ==========
🔍 ========== PROCESSING PUB/SUB MESSAGE ==========
✅ Gmail event received
```

### Step 5: Check Pub/Sub Message Delivery

In Google Cloud Console:

1. **Go to Pub/Sub → Subscriptions**
2. **Click on your subscription**
3. **Check "Messages" tab:**
   - Are there any messages?
   - Are messages being delivered?
   - Any delivery errors?

4. **Check "Metrics" tab:**
   - Message delivery rate
   - Push endpoint errors
   - Acknowledgement rate

### Step 6: Common Issues

#### Issue 1: Webhook Not Accessible (Local Testing)

**Problem:** Testing locally, but Pub/Sub can't reach `localhost:3001`

**Solution:** Use ngrok
```bash
# Install ngrok
npm install -g ngrok

# Start tunnel
ngrok http 3001

# Update Pub/Sub subscription push endpoint to:
# https://abc123.ngrok.io/api/pubsub/gmail
```

#### Issue 2: Wrong Push Endpoint URL

**Problem:** Push endpoint doesn't match your actual endpoint

**Solution:** 
- Check exact URL in Pub/Sub subscription
- Must be: `https://your-domain.com/api/pubsub/gmail`
- No trailing slash
- Must be HTTPS

#### Issue 3: Gmail Watch Not Sending to Pub/Sub

**Problem:** Watch is active, but Gmail isn't sending events to Pub/Sub

**Check:**
- Topic name matches: `projects/blocks-1b5ba/topics/gmail-deposit-events`
- Topic exists in Google Cloud Console
- Service account has permissions to publish to topic

#### Issue 4: Subscription Not Linked to Topic

**Problem:** Subscription exists but isn't receiving messages from topic

**Solution:**
- Verify subscription is subscribed to correct topic
- Check subscription filter (should be empty for all messages)

### Step 7: Enable Pub/Sub Logging

In Google Cloud Console:

1. **Go to Pub/Sub → Subscriptions**
2. **Click on your subscription**
3. **Enable "Delivery logs"**
4. **Check for errors:**
   - HTTP errors (404, 500, etc.)
   - Timeout errors
   - Authentication errors

## Quick Test Checklist

- [ ] Gmail watch is active (expiration date is future)
- [ ] Pub/Sub subscription exists and is active
- [ ] Push endpoint URL is correct and accessible
- [ ] Webhook endpoint returns 200 OK
- [ ] Topic name matches in watch and subscription
- [ ] Service account has proper permissions
- [ ] If local: Using ngrok with correct URL

## Expected Flow

1. **New email arrives** → Gmail inbox
2. **Gmail watch detects** → Sends event to Pub/Sub topic
3. **Pub/Sub receives** → Pushes to subscription
4. **Subscription pushes** → HTTP POST to your webhook
5. **Webhook logs:** `📩 ========== GMAIL WEBHOOK HIT ==========`
6. **Processing starts:** `🔍 ========== PROCESSING PUB/SUB MESSAGE ==========`

## If Webhook Still Not Being Hit

1. **Check Pub/Sub subscription delivery logs** in Google Cloud Console
2. **Verify webhook URL is accessible** (test with curl)
3. **Check if topic is receiving messages** (Pub/Sub → Topics → Messages)
4. **Verify Gmail watch topic name** matches subscription topic
5. **Check service account permissions** for Pub/Sub

