# Quick Start - Testing Push Notifications Locally

## ✅ What You Need

1. **Database Migration:** `database/migrations/add-push-notifications.sql`
2. **Environment Variables:** (see below)
3. **Backend Running:** `npm run start:dev` on `http://localhost:3000`

---

## 🗄️ Database Migration

**File to Run:** `database/migrations/add-push-notifications.sql`

**How to Run:**
```bash
psql 'postgresql://neondb_owner:npg_hI8EYzein0WC@ep-soft-resonance-a1frot6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

Then in psql:
```sql
\i database/migrations/add-push-notifications.sql
```

**What It Does:**
- Adds `expoToken` column to `users` table
- Adds `webPushSubscription` column to `users` table  
- Creates `notifications` table

---

## 🔧 Environment Variables

Add to `.env` file in `Blocks-Backend/`:

```env
DATABASE_URL=postgresql://neondb_owner:npg_hI8EYzein0WC@ep-soft-resonance-a1frot6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=eyJVc2VySUQiOiI2YzZiMjM5ZS1kNDI3LTRkZGUtODYyYi1kMTZjZmVjYmU0M2UiLCJQYXNzd29yZCI6IjNlNzg4YTc2YzkyODRmZTQ4MWI2MTAxNzgyODM3YTE1In0=
QSTASH_CURRENT_SIGNING_KEY=sig_4mdAPYt8q9AfjMqfx3UTx5Mw344R
QSTASH_NEXT_SIGNING_KEY=sig_4pAk33wKYB6sr1tA4Ubt552cx7R9

API_URL=http://localhost:3000

VAPID_PUBLIC_KEY=BDfnqRXUeIy1OGOqKi3w8jqajKP0RH7b84r-hnCi80wICgniqOpoM24MUgGmfBV9pPmrimjGr6dRjJ9HvG1-hGk
VAPID_PRIVATE_KEY=F0V_fli8eR-bGbeUeBoE6Bt3L4EjOTp8jXW73ur6Xvg
VAPID_EMAIL=robasahmedshah@gmail.com
```

---

## 🧪 Insomnia API Tests

### 1. Login with Expo Token (Auto-Register)

**POST** `http://localhost:3000/api/mobile/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "expoToken": "ExponentPushToken[test-token-123]"
}
```

**Response:** JWT token + user data

---

### 2. Login with Web Push (Auto-Register)

**POST** `http://localhost:3000/api/mobile/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "webPushSubscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/test",
    "keys": {
      "p256dh": "test-key",
      "auth": "test-auth"
    }
  }
}
```

**Response:** JWT token + user data

---

### 3. Get User Notifications

**GET** `http://localhost:3000/api/notifications`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:** List of notifications

---

### 4. Distribute ROI (Triggers Notifications)

**POST** `http://localhost:3000/api/rewards/distribute`

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "propertyId": "PROP-000001",
  "totalRoiUSDT": 100000
}
```

**What Happens:**
- Rewards distributed to all investors
- Notifications queued to QStash
- QStash calls `/api/notifications/process`
- Push notifications sent

**Note:** For local testing, use ngrok so QStash can reach your server.

---

## 🚀 Testing with QStash (Local)

### Problem:
QStash can't call `localhost:3000` from the internet.

### Solution: Use ngrok

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start ngrok:**
   ```bash
   ngrok http 3000
   ```

3. **Copy ngrok URL** (e.g., `https://abc123.ngrok.io`)

4. **Update `.env`:**
   ```env
   API_URL=https://abc123.ngrok.io
   ```

5. **Restart backend**

Now QStash can call your local server!

---

## ✅ Testing Checklist

- [ ] Database migration run
- [ ] Environment variables set
- [ ] Backend running
- [ ] Login with token works
- [ ] Token saved to database
- [ ] Distribute ROI works
- [ ] QStash processes jobs
- [ ] Notifications in database

---

## 📝 Quick SQL Queries

**Check user has token:**
```sql
SELECT id, email, "expoToken", "webPushSubscription" 
FROM users 
WHERE email = 'user@example.com';
```

**Check notifications:**
```sql
SELECT * FROM notifications 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

---

## 🎯 Full Testing Guide

See `LOCAL_TESTING_GUIDE.md` for complete instructions.

---

## 🐛 Troubleshooting

**QStash can't reach server:**
- Use ngrok
- Update `API_URL` in `.env`
- Restart backend

**Signature verification fails:**
- For local testing, remove `QSTASH_CURRENT_SIGNING_KEY` temporarily
- Or check keys are correct

**Notifications not sending:**
- Check user has tokens in database
- Check QStash dashboard
- Check backend logs

---

Ready to test! 🚀


