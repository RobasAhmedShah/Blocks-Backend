# QStash Push Notifications Setup Guide

## Overview

This guide explains how to set up push notifications using QStash (Upstash) for Vercel deployment.

## What Changed

- ✅ Replaced BullMQ with QStash (serverless-compatible)
- ✅ Removed long-running worker (not needed with QStash)
- ✅ Added automatic push token registration on login
- ✅ Updated database connection to use `pushnotification` branch

---

## Step 1: Get QStash Token

1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign up or log in (free tier available)
3. Create a new QStash project
4. Copy your **QStash Token** from the dashboard

---

## Step 2: Generate Web Push VAPID Keys

Run this command in your terminal:

```bash
npx web-push generate-vapid-keys
```

This will output:
```
Public Key: <your-public-key>
Private Key: <your-private-key>
```

Save both keys.

---

## Step 3: Update Environment Variables

Add these to your `.env` file (or Vercel environment variables):

```env
# Database (pushnotification branch)
DATABASE_URL=postgresql://neondb_owner:npg_hI8EYzein0WC@ep-soft-resonance-a1frot6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# QStash Configuration
QSTASH_TOKEN=your-qstash-token-from-upstash-console

# API URL (for QStash callbacks)
# For local development:
API_URL=http://localhost:3000
# For Vercel production, Vercel automatically sets VERCEL_URL
# Or you can set it manually:
API_URL=https://your-app.vercel.app

# Web Push VAPID Keys
VAPID_PUBLIC_KEY=your-public-key-from-step-2
VAPID_PRIVATE_KEY=your-private-key-from-step-2
VAPID_EMAIL=admin@yourapp.com
```

---

## Step 4: Run Database Migration

Connect to your Neon `pushnotification` branch and run:

```bash
psql 'postgresql://neondb_owner:npg_hI8EYzein0WC@ep-soft-resonance-a1frot6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

Then run:
```sql
\i database/migrations/add-push-notifications.sql
```

Or manually execute the SQL from `database/migrations/add-push-notifications.sql`.

---

## Step 5: Deploy to Vercel

1. Push your code to GitHub
2. Connect to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

**Important:** Make sure `API_URL` is set to your Vercel URL in production, or QStash won't be able to call your processing endpoint.

---

## How It Works

### 1. User Login with Push Tokens

When a user logs in, they can optionally include push tokens:

**Mobile App (React Native):**
```json
POST /api/mobile/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "expoToken": "ExponentPushToken[xxxxxxxxxxxxxx]"
}
```

**Web App (Next.js):**
```json
POST /api/mobile/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "webPushSubscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

The tokens are automatically saved to the database during login.

### 2. Reward Distribution Triggers Notifications

When an admin distributes ROI:
```
POST /api/rewards/distribute
{
  "propertyId": "PROP-000001",
  "totalRoiUSDT": 100000
}
```

The backend:
1. Distributes rewards to all investors
2. Queues a notification job to QStash for each user
3. Returns immediately (non-blocking)

### 3. QStash Processes Notifications

QStash:
1. Receives the job
2. Calls your `/api/notifications/process` endpoint
3. Your endpoint sends push notifications
4. Retries automatically if it fails

---

## API Endpoints

### Process Notification (QStash calls this)
- **POST** `/api/notifications/process` (Public - QStash calls this)
- Body: `{ userId, title, message, data }`

### Register Expo Token (Manual)
- **POST** `/api/notifications/register-expo-token`
- Requires: JWT token
- Body: `{ token: "ExponentPushToken[...]" }`

### Register Web Push (Manual)
- **POST** `/api/notifications/register-web-push`
- Requires: JWT token
- Body: `{ subscription: { endpoint, keys } }`

### Get User Notifications
- **GET** `/api/notifications`
- Requires: JWT token
- Returns: List of user's notifications

---

## Testing

### Test QStash Connection

1. Check logs when you queue a notification
2. Look for: `Notification queued for user {userId}`
3. Check QStash dashboard for job status
4. Check your `/api/notifications/process` endpoint logs

### Test Push Notifications

1. Login with a push token
2. Distribute a reward
3. Check if notification arrives on device/browser

---

## Troubleshooting

### Notifications Not Sending

1. **Check QStash Token:**
   - Verify `QSTASH_TOKEN` is set correctly
   - Check QStash dashboard for errors

2. **Check API URL:**
   - `API_URL` must be accessible from internet
   - For Vercel, use your production URL
   - QStash needs to call this URL

3. **Check User Tokens:**
   ```sql
   SELECT id, email, "expoToken", "webPushSubscription" 
   FROM users 
   WHERE id = 'user-uuid';
   ```

4. **Check QStash Dashboard:**
   - Go to Upstash Console → QStash
   - Check job status and retry history

### QStash Can't Reach Your Endpoint

- Make sure `API_URL` is correct
- For local development, use a tunnel (ngrok, localtunnel)
- For Vercel, ensure deployment is successful

### Invalid Push Tokens

The system automatically removes invalid tokens:
- Expo: Removes if `DeviceNotRegistered` error
- Web Push: Removes if status 410 or 404

---

## Cost

- **QStash Free Tier:** 10,000 requests/month
- **Upstash Redis (if needed):** Free tier available
- **Vercel:** Free tier for serverless functions

---

## Migration from BullMQ

If you had BullMQ before:
- ✅ All BullMQ code removed
- ✅ No Redis needed (QStash handles queue)
- ✅ No separate worker service needed
- ✅ Works entirely on Vercel

---

## Next Steps

1. Get QStash token from Upstash
2. Generate VAPID keys
3. Update environment variables
4. Run database migration
5. Deploy to Vercel
6. Test with a reward distribution

For detailed implementation docs, see `PUSH_NOTIFICATIONS_IMPLEMENTATION.md`.


