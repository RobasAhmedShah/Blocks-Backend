# Fix QStash Error - Step by Step

## 🔴 Current Error

```
ERROR [NotificationsService] QStash not initialized - cannot queue notification
WARN [NotificationsService] QSTASH_TOKEN not configured
WARN [NotificationsService] VAPID keys not configured
```

## ✅ Root Cause

**Environment variables are not being loaded from `.env` file.**

## 🔧 Solution

### Step 1: Add Environment Variables

Open `Blocks-Backend/.env` file and **add these lines** (don't remove existing ones):

```env
# QStash Configuration
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=eyJVc2VySUQiOiI2YzZiMjM5ZS1kNDI3LTRkZGUtODYyYi1kMTZjZmVjYmU0M2UiLCJQYXNzd29yZCI6IjNlNzg4YTc2YzkyODRmZTQ4MWI2MTAxNzgyODM3YTE1In0=
QSTASH_CURRENT_SIGNING_KEY=sig_4mdAPYt8q9AfjMqfx3UTx5Mw344R
QSTASH_NEXT_SIGNING_KEY=sig_4pAk33wKYB6sr1tA4Ubt552cx7R9

# API URL (for QStash callbacks)
API_URL=http://localhost:3000

# Web Push VAPID Keys
VAPID_PUBLIC_KEY=BDfnqRXUeIy1OGOqKi3w8jqajKP0RH7b84r-hnCi80wICgniqOpoM24MUgGmfBV9pPmrimjGr6dRjJ9HvG1-hGk
VAPID_PRIVATE_KEY=F0V_fli8eR-bGbeUeBoE6Bt3L4EjOTp8jXW73ur6Xvg
VAPID_EMAIL=robasahmedshah@gmail.com
```

**Important:**
- Make sure `.env` file is in `Blocks-Backend/` folder (same level as `package.json`)
- No spaces around `=` sign
- No quotes around values
- Each variable on its own line

### Step 2: Restart Backend

**CRITICAL:** After adding variables, you MUST restart:

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm start
```

### Step 3: Verify It Works

After restart, check logs. You should see:

```
✅ [NotificationsService] QStash client initialized
✅ [NotificationsService] Web Push VAPID details configured
✅ [QStashSignatureGuard] QStash signature verification enabled
```

**NOT these warnings:**
```
❌ QSTASH_TOKEN not configured
❌ VAPID keys not configured
```

---

## 📱 About Mobile App Code

### Yes, You Need Mobile App Code (But Later)

**Right now, fix the backend first!**

### The Complete Flow:

```
1. User opens mobile app
   ↓
2. App gets Expo push token
   ↓
3. User logs in → Includes expoToken in login request
   ↓
4. Backend saves token automatically
   ↓
5. Admin distributes ROI
   ↓
6. Backend queues notification to QStash
   ↓
7. QStash calls /api/notifications/process
   ↓
8. Push notification sent to user's device
```

### Mobile App Code (For Later):

**In your React Native app, after login:**

```typescript
import * as Notifications from 'expo-notifications';

// Get push token
const token = await Notifications.getExpoPushTokenAsync();

// Login with token (automatic registration)
const response = await fetch('http://your-api.com/api/mobile/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    expoToken: token.data, // ← This automatically saves the token!
  }),
});
```

**OR register separately after login:**

```typescript
// After login, register token
await fetch('http://your-api.com/api/notifications/register-expo-token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ token: token.data }),
});
```

---

## 🧪 Testing Without Mobile App

You can test the backend without mobile app:

### Test 1: Register Token Manually (Insomnia)

**POST** `http://localhost:3000/api/notifications/register-expo-token`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "token": "ExponentPushToken[test-token-12345]"
}
```

### Test 2: Login with Token (Insomnia)

**POST** `http://localhost:3000/api/mobile/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "expoToken": "ExponentPushToken[test-token-12345]"
}
```

This automatically saves the token!

### Test 3: Distribute ROI

**POST** `http://localhost:3000/api/rewards/distribute`

**Body:**
```json
{
  "propertyId": "PROP-000050",
  "totalRoiUSDT": 100000
}
```

**Expected:**
- ✅ Rewards distributed
- ✅ Notifications queued to QStash
- ✅ Check QStash dashboard for job status

---

## ⚠️ Important: QStash Local Testing

**For local testing, QStash needs to call your server:**

### Problem:
QStash can't reach `localhost:3000` from the internet.

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

## ✅ Complete Fix Checklist

- [ ] Added QStash variables to `.env`
- [ ] Added VAPID variables to `.env`
- [ ] Restarted backend server
- [ ] Verified logs show "QStash client initialized"
- [ ] Registered push token for test user (via login or manual)
- [ ] For local testing: Started ngrok and updated `API_URL`

---

## 🎯 Summary

**The error is because:**
1. ❌ Environment variables not in `.env` file
2. ❌ Backend not restarted after adding variables

**To fix:**
1. ✅ Add variables to `.env`
2. ✅ Restart backend
3. ✅ Register push tokens (via login or manual)
4. ✅ Test with ROI distribution

**Mobile app code:**
- ✅ Needed for production
- ✅ Can test backend without it first
- ✅ Login endpoint already handles token registration automatically

---

## 🚀 Next Steps

1. **Fix `.env` file** → Add all QStash and VAPID variables
2. **Restart backend** → Verify logs show initialization
3. **Test in Insomnia** → Register token, distribute ROI
4. **Add mobile code** → When ready to test on device

The backend code is ready - just needs the environment variables! 🎉


