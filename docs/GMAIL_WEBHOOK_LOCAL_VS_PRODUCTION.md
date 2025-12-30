# Gmail Webhook: Local vs Production Testing

## Current Situation

Your Pub/Sub subscription is set to:
```
https://blocks-backend.vercel.app/api/pubsub/gmail
```

This means:
- ✅ **Production backend** will receive webhooks when emails arrive
- ❌ **Local backend** will NOT receive webhooks (Pub/Sub sends to Vercel, not localhost)

## Why It Can't Work Locally Without ngrok

1. **Pub/Sub sends to the configured URL** - It doesn't know about your localhost
2. **Production URL is hardcoded** - `https://blocks-backend.vercel.app` always goes to Vercel
3. **No way to redirect** - Pub/Sub can't be told "send to localhost instead"

## Your Options

### Option 1: Test Locally with ngrok (Recommended for Development)

**When to use:** When you want to see logs locally and debug

**Steps:**
1. Start ngrok:
   ```bash
   ngrok http 3001
   ```
2. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
3. Update Pub/Sub subscription endpoint to:
   ```
   https://abc123.ngrok.io/api/pubsub/gmail
   ```
4. Now webhooks will hit your local backend
5. You'll see logs: `📩 ========== GMAIL WEBHOOK HIT ==========`

**Pros:**
- ✅ See logs locally
- ✅ Debug easily
- ✅ Test parsing logic
- ✅ No database changes (we disabled wallet crediting)

**Cons:**
- ❌ Need to update Pub/Sub subscription each time ngrok restarts
- ❌ ngrok URL changes on restart (free tier)

### Option 2: Test with Production Backend

**When to use:** When you want to test the full flow including database

**Steps:**
1. Keep Pub/Sub subscription pointing to: `https://blocks-backend.vercel.app/api/pubsub/gmail`
2. Deploy your latest code to Vercel
3. Send test email
4. Check Vercel logs (not local logs)

**Pros:**
- ✅ Tests production environment
- ✅ No ngrok needed
- ✅ Real database updates

**Cons:**
- ❌ Can't see logs locally
- ❌ Harder to debug
- ❌ Need to deploy for each change

### Option 3: Test Webhook Manually (Local Testing Without ngrok)

**When to use:** When you just want to test parsing logic locally

**Steps:**
1. Keep Pub/Sub subscription pointing to production
2. Test webhook manually:
   ```bash
   node scripts/test-pubsub-gmail.js
   ```
3. This hits your local backend directly (bypasses Pub/Sub)

**Pros:**
- ✅ Test parsing logic locally
- ✅ See logs locally
- ✅ No ngrok needed
- ✅ No subscription changes

**Cons:**
- ❌ Doesn't test actual Gmail watch flow
- ❌ Manual testing only
- ❌ Won't receive real email events

## Recommendation

**For now (testing parsing):**
- Use **Option 3** (manual testing) to verify parsing works locally
- Keep subscription pointing to production

**For full testing:**
- Use **Option 1** (ngrok) to test the complete flow locally
- Update subscription to ngrok URL temporarily
- Remember to change it back to production when done

## Quick Commands

### Test Locally (Manual)
```bash
node scripts/test-pubsub-gmail.js
```

### Test with ngrok
```bash
# Terminal 1: Start backend
npm run start:dev

# Terminal 2: Start ngrok
ngrok http 3001

# Then update Pub/Sub subscription to: https://YOUR-NGROK-URL.ngrok.io/api/pubsub/gmail
```

### Test with Production
```bash
# Just send an email to your Gmail inbox
# Check Vercel logs at: https://vercel.com/your-project/logs
```

