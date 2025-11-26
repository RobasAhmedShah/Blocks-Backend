# Local Testing Guide - Push Notifications with QStash

## 📋 Prerequisites

1. ✅ Database migration run on Neon `pushnotification` branch
2. ✅ Environment variables configured
3. ✅ Backend running locally on `http://localhost:3000`

---

## 🗄️ Database Migration

### Which Migration to Run?

**File:** `database/migrations/add-push-notifications.sql`

This migration:
- Adds `expoToken` column to `users` table
- Adds `webPushSubscription` column to `users` table
- Creates `notifications` table

### How to Run:

1. **Connect to Neon pushnotification branch:**
   ```bash
   psql 'postgresql://neondb_owner:npg_hI8EYzein0WC@ep-soft-resonance-a1frot6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
   ```

2. **Run the migration:**
   ```sql
   \i database/migrations/add-push-notifications.sql
   ```
   
   Or copy-paste the entire SQL from the file and run it.

3. **Verify migration:**
   ```sql
   -- Check users table has new columns
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name IN ('expoToken', 'webPushSubscription');
   
   -- Check notifications table exists
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name = 'notifications';
   ```

---

## 🔧 Environment Variables Setup

Create/update your `.env` file in `Blocks-Backend/`:

```env
# Database (pushnotification branch)
DATABASE_URL=postgresql://neondb_owner:npg_hI8EYzein0WC@ep-soft-resonance-a1frot6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# QStash Configuration
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=eyJVc2VySUQiOiI2YzZiMjM5ZS1kNDI3LTRkZGUtODYyYi1kMTZjZmVjYmU0M2UiLCJQYXNzd29yZCI6IjNlNzg4YTc2YzkyODRmZTQ4MWI2MTAxNzgyODM3YTE1In0=
QSTASH_CURRENT_SIGNING_KEY=sig_4mdAPYt8q9AfjMqfx3UTx5Mw344R
QSTASH_NEXT_SIGNING_KEY=sig_4pAk33wKYB6sr1tA4Ubt552cx7R9

# API URL (for QStash callbacks - use ngrok for local testing)
API_URL=http://localhost:3000
# OR use ngrok: API_URL=https://your-ngrok-url.ngrok.io

# Web Push VAPID Keys
VAPID_PUBLIC_KEY=BDfnqRXUeIy1OGOqKi3w8jqajKP0RH7b84r-hnCi80wICgniqOpoM24MUgGmfBV9pPmrimjGr6dRjJ9HvG1-hGk
VAPID_PRIVATE_KEY=F0V_fli8eR-bGbeUeBoE6Bt3L4EjOTp8jXW73ur6Xvg
VAPID_EMAIL=robasahmedshah@gmail.com

# JWT (if not already set)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

---

## 🧪 Insomnia API Testing Guide

### Setup Insomnia

1. Create a new collection: "Blocks Backend - Push Notifications"
2. Set base URL: `http://localhost:3000`

---

### Test 1: Login with Expo Token (Automatic Registration)

**Endpoint:** `POST /api/mobile/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "expoToken": "ExponentPushToken[test-token-12345]"
}
```

**Expected Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "User Name",
    ...
  },
  "token": "jwt-token-here",
  "refreshToken": "refresh-token-here"
}
```

**What Happens:**
- User logs in
- Expo token is automatically saved to database
- JWT token returned for subsequent requests

---

### Test 2: Login with Web Push Subscription (Automatic Registration)

**Endpoint:** `POST /api/mobile/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "webPushSubscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
    "keys": {
      "p256dh": "test-p256dh-key",
      "auth": "test-auth-key"
    }
  }
}
```

**Expected Response:** Same as Test 1

**What Happens:**
- User logs in
- Web push subscription is automatically saved to database
- JWT token returned

---

### Test 3: Register Expo Token (Manual - Alternative to Login)

**Endpoint:** `POST /api/notifications/register-expo-token`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token-from-login>
```

**Body (JSON):**
```json
{
  "token": "ExponentPushToken[test-token-12345]"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Expo token registered successfully"
}
```

---

### Test 4: Register Web Push Subscription (Manual - Alternative to Login)

**Endpoint:** `POST /api/notifications/register-web-push`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token-from-login>
```

**Body (JSON):**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
    "keys": {
      "p256dh": "test-p256dh-key",
      "auth": "test-auth-key"
    }
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Web push subscription registered successfully"
}
```

---

### Test 5: Get User Notifications

**Endpoint:** `GET /api/notifications`

**Headers:**
```
Authorization: Bearer <jwt-token-from-login>
```

**Expected Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "Reward Credited",
      "message": "A new reward of 10.500000 USDT...",
      "data": {
        "type": "reward",
        "rewardId": "uuid",
        "propertyId": "uuid",
        "amountUSDT": "10.500000"
      },
      "status": "sent",
      "platform": "expo",
      "createdAt": "2025-11-26T..."
    }
  ]
}
```

---

### Test 6: Distribute ROI (Triggers Notifications)

**Endpoint:** `POST /api/rewards/distribute`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <admin-jwt-token>
```

**Body (JSON):**
```json
{
  "propertyId": "PROP-000001",
  "totalRoiUSDT": 100000
}
```

**Expected Response:**
```json
{
  "rewards": [...],
  "count": 5,
  "totalDistributed": "100000"
}
```

**What Happens:**
1. Rewards distributed to all investors
2. Notification jobs queued to QStash for each user
3. QStash calls `/api/notifications/process` endpoint
4. Push notifications sent to users with registered tokens
5. Notifications saved to database

**Note:** For local testing, you need ngrok or similar to expose your local server to QStash.

---

### Test 7: Process Notification (QStash Endpoint - Manual Test)

**Endpoint:** `POST /api/notifications/process`

**Headers:**
```
Content-Type: application/json
Upstash-Signature: <signature-from-qstash>
```

**Body (JSON):**
```json
{
  "userId": "user-uuid-here",
  "title": "Test Notification",
  "message": "This is a test notification",
  "data": {
    "type": "test",
    "testId": "123"
  }
}
```

**Note:** This endpoint is normally called by QStash. For manual testing, you can temporarily disable signature verification by not setting `QSTASH_CURRENT_SIGNING_KEY` in `.env`.

---

## 🚀 Local Testing with QStash

### Problem:
QStash needs to call your local server, but `localhost:3000` is not accessible from the internet.

### Solution: Use ngrok

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   # OR download from https://ngrok.com/
   ```

2. **Start your backend:**
   ```bash
   cd Blocks-Backend
   npm run start:dev
   ```

3. **Start ngrok:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

5. **Update `.env`:**
   ```env
   API_URL=https://abc123.ngrok.io
   ```

6. **Restart your backend** to pick up the new `API_URL`

Now QStash can call your local server!

---

## ✅ Testing Checklist

- [ ] Database migration run successfully
- [ ] Environment variables set
- [ ] Backend running on `http://localhost:3000`
- [ ] Login with expoToken works
- [ ] Login with webPushSubscription works
- [ ] Token saved to database (check with SQL query)
- [ ] Distribute ROI triggers notifications
- [ ] QStash processes jobs (check QStash dashboard)
- [ ] Notifications appear in database
- [ ] Push notifications sent (check device/browser)

---

## 🔍 Verify Database

### Check User Has Token:
```sql
SELECT id, email, "expoToken", "webPushSubscription" 
FROM users 
WHERE email = 'user@example.com';
```

### Check Notifications:
```sql
SELECT * FROM notifications 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

### Check Notification Status:
```sql
SELECT status, platform, COUNT(*) 
FROM notifications 
GROUP BY status, platform;
```

---

## 🐛 Troubleshooting

### QStash Can't Reach Local Server
- Use ngrok to expose local server
- Update `API_URL` in `.env`
- Restart backend

### Signature Verification Fails
- Check `QSTASH_CURRENT_SIGNING_KEY` is correct
- For local testing, you can temporarily remove it to skip verification

### Notifications Not Sending
- Check user has tokens in database
- Check QStash dashboard for job status
- Check backend logs for errors
- Verify VAPID keys are correct

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check you're connected to `pushnotification` branch
- Verify migration was run successfully

---

## 📝 Next Steps After Local Testing

1. Test all endpoints in Insomnia
2. Verify notifications are queued to QStash
3. Check QStash dashboard for job processing
4. Verify notifications saved to database
5. Deploy to Vercel with production `API_URL`

---

## 🎯 Quick Test Flow

1. **Login** → Token saved automatically
2. **Distribute ROI** → Notifications queued
3. **Check QStash Dashboard** → Jobs processing
4. **Check Database** → Notifications saved
5. **Check Device** → Push notification received

Good luck testing! 🚀

