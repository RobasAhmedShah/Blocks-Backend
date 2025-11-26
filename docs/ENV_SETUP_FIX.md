# Environment Variables Setup - Fix QStash Error

## 🔴 Problem

You're seeing these errors:
```
ERROR [NotificationsService] QStash not initialized - cannot queue notification
WARN [NotificationsService] QSTASH_TOKEN not configured
WARN [NotificationsService] VAPID keys not configured
```

## ✅ Solution

### Step 1: Add Environment Variables to `.env` File

Open `Blocks-Backend/.env` file and add these lines:

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

# Database (pushnotification branch)
DATABASE_URL=postgresql://neondb_owner:npg_hI8EYzein0WC@ep-soft-resonance-a1frot6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Step 2: Restart Your Backend

**IMPORTANT:** After adding environment variables, you MUST restart the server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm start
# OR
npm run start:dev
```

### Step 3: Verify Configuration

After restart, you should see in logs:
```
✅ [NotificationsService] QStash client initialized
✅ [NotificationsService] Web Push VAPID details configured
✅ [QStashSignatureGuard] QStash signature verification enabled
```

If you still see warnings, check:
1. `.env` file is in `Blocks-Backend/` folder (same level as `package.json`)
2. No typos in variable names
3. No extra spaces around `=` sign
4. Server was restarted after adding variables

---

## 📱 About Mobile App Code

### Yes, You Need Mobile App Code!

**But first, let's fix the backend issue above.**

### The Complete Flow:

1. **User logs in** → Mobile app gets Expo push token
2. **Login API call** → Includes `expoToken` in login request
3. **Backend saves token** → Automatically during login
4. **Admin distributes ROI** → Backend queues notifications
5. **QStash processes** → Calls your endpoint
6. **Push notification sent** → User receives on device

### Mobile App Code Needed:

**React Native (Expo):**
```typescript
import * as Notifications from 'expo-notifications';

// After user logs in successfully
async function registerPushToken(authToken: string) {
  const token = await Notifications.getExpoPushTokenAsync();
  
  // Send to backend (already done in login, but can also do separately)
  await fetch('http://localhost:3000/api/notifications/register-expo-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: token.data }),
  });
}
```

**But wait!** The login endpoint already handles this automatically if you include `expoToken` in the login request.

---

## 🧪 Testing Without Mobile App (For Now)

You can test the notification system without the mobile app:

### Test 1: Register Token Manually

**POST** `http://localhost:3000/api/notifications/register-expo-token`

**Headers:**
```
Authorization: Bearer <jwt-token-from-login>
Content-Type: application/json
```

**Body:**
```json
{
  "token": "ExponentPushToken[test-token-12345]"
}
```

### Test 2: Distribute ROI

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
- ✅ QStash processes jobs
- ✅ Push notifications sent (if user has token)

---

## 🔍 Why It's Not Working Now

1. **QStash not initialized** → Environment variables not set
2. **Users don't have tokens** → Need to register tokens first
3. **QStash can't reach localhost** → Need ngrok for local testing

---

## ✅ Complete Fix Steps

1. **Add environment variables** to `.env` (see Step 1 above)
2. **Restart backend** (see Step 2 above)
3. **Register push tokens** for test users:
   - Login with `expoToken` in request, OR
   - Call `/api/notifications/register-expo-token` manually
4. **For local QStash testing**, use ngrok:
   ```bash
   ngrok http 3000
   # Update API_URL in .env to ngrok URL
   # Restart backend
   ```
5. **Distribute ROI** → Notifications should work!

---

## 📝 Quick Checklist

- [ ] `.env` file has all QStash variables
- [ ] `.env` file has all VAPID variables
- [ ] Backend restarted after adding variables
- [ ] Logs show "QStash client initialized"
- [ ] Users have push tokens registered (check database)
- [ ] For local testing: ngrok running and `API_URL` updated

---

## 🎯 Next Steps

1. **Fix environment variables** (add to `.env` and restart)
2. **Test with Insomnia** (register token manually)
3. **Add mobile app code** (when ready to test on device)

The backend is ready - just needs the environment variables! 🚀

