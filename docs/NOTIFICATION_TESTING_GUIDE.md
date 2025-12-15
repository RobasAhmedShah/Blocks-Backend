# Notification Testing Guide - Localhost

## ✅ What's Already Set Up

1. **Backend:**
   - ✅ Firebase Admin SDK installed
   - ✅ FIREBASE_SERVICE_ACCOUNT in .env
   - ✅ Backend detects and handles both Expo and FCM tokens
   - ✅ Notifications service ready

2. **App:**
   - ✅ Token generation in `useNotifications.ts`
   - ✅ Automatic token registration on login
   - ✅ Token sent to backend via login API

## 🧪 Testing Checklist

### Step 1: Start Backend Server

```bash
cd Blocks-Backend
npm run start:dev
```

**Check for these logs on startup:**
```
[NotificationsService] Firebase Admin initialized for FCM notifications
[NotificationsService] QStash client initialized
```

If you see warnings instead, check:
- `FIREBASE_SERVICE_ACCOUNT` is in `.env`
- JSON format is correct (single line, no newlines)

### Step 2: Verify Backend is Running

- Backend should be on: `http://localhost:3000` (or your configured port)
- Check: `http://localhost:3000/api/health` (if available)

### Step 3: Test Token Registration (App Side)

1. **Open your app** (Expo Go or standalone APK)
2. **Log in** with a test user
3. **Check app console logs** for:
   ```
   📱 Getting push token - Device.isDevice: true, ProjectId: ead54695-f47e-4652-809f-4d7992799c28
   ✅ Expo push token obtained: ExponentPushToken[...]
   📤 Registering push token with backend...
   ✅ Push token registered successfully
   ```

4. **Check backend logs** for:
   ```
   [MobileAuthService] User logged in with expoToken
   [NotificationsService] Expo token registered for user [userId]
   ```

### Step 4: Verify Token in Database

Run this SQL query in your database:

```sql
SELECT 
  id, 
  email, 
  LEFT("expoToken", 50) as token_preview,
  CASE 
    WHEN "expoToken" LIKE 'ExponentPushToken[%' THEN 'Expo Token'
    WHEN "expoToken" LIKE '%:%' AND LENGTH("expoToken") > 50 THEN 'FCM Token'
    ELSE 'Unknown Format'
  END as token_type,
  LENGTH("expoToken") as token_length
FROM users 
WHERE "expoToken" IS NOT NULL
ORDER BY "updatedAt" DESC
LIMIT 5;
```

**Expected results:**
- **Expo Go:** Token format: `ExponentPushToken[xxxxxxxxxxxxxx]`
- **Standalone APK:** Token format: `fkqKu_lGRZyf_qVtp-wRFO:APA91bF...` (long string with colons)

### Step 5: Test Notification Sending

#### Option A: Via Admin Panel (Web)

1. Go to: `http://localhost:3000/admin` (or your admin URL)
2. Navigate to "Send Notifications"
3. Select a user (one with a registered token)
4. Send a test notification

#### Option B: Via API (Insomnia/Postman)

**POST** `http://localhost:3000/api/admin/notifications/send`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your-admin-jwt-token>
```

**Body:**
```json
{
  "userIds": ["03260e15-5ed7-46c9-a58d-9807d71818c2"],
  "title": "Test Notification",
  "message": "This is a test from localhost",
  "category": "test",
  "customUrl": "/notifications?context=portfolio"
}
```

### Step 6: Check Backend Logs

When you send a notification, check backend logs for:

**For Expo Tokens:**
```
[NotificationsService] 📤 Sending Expo push notification to user [userId]
[NotificationsService] ✅ Expo notification sent successfully to user [userId]
```

**For FCM Tokens:**
```
[NotificationsService] 📤 Sending FCM push notification to user [userId]
[NotificationsService] ✅ FCM notification sent successfully to user [userId]. Message ID: [message-id]
```

### Step 7: Verify Notification Received

1. **Check device** - Notification should appear
2. **Tap notification** - App should open and navigate to the URL
3. **Check app logs** - Should show notification received

## 🔍 Troubleshooting

### Issue: "FIREBASE_SERVICE_ACCOUNT not configured"

**Solution:**
- Check `.env` file has `FIREBASE_SERVICE_ACCOUNT=...`
- Restart backend after adding it
- Check JSON is on a single line (no newlines)

### Issue: "Failed to initialize Firebase Admin"

**Solution:**
- Check JSON format is valid
- Try parsing it: `JSON.parse(your-firebase-json-string)`
- Ensure all required fields are present

### Issue: Token not being registered

**Check:**
1. App console logs show token generation
2. Login request includes `expoToken` in body
3. Backend logs show token received
4. Database has token stored

**Fix:**
- Re-login to register token
- Check app's `useNotifications.ts` is calling registration
- Verify API endpoint is correct

### Issue: "Invalid token format" warning

**This is OK!** The backend will:
1. Try Expo service first
2. If that fails, try FCM service
3. If both fail, remove invalid token

### Issue: Notification sent but not received

**Check:**
1. Device has internet connection
2. App has notification permissions enabled
3. Token is valid (not expired)
4. Backend logs show "sent successfully"
5. For FCM: Check Firebase Console for delivery status

### Issue: Works in Expo Go but not in APK

**Check:**
1. FCM credentials configured in EAS: `eas credentials`
2. APK rebuilt after FCM configuration
3. `FIREBASE_SERVICE_ACCOUNT` is set in backend
4. Token format is FCM (not Expo) in database

## 📝 Testing Both Environments

### Expo Go Testing:
1. Run app in Expo Go
2. Login → Token should be `ExponentPushToken[...]`
3. Send notification → Should work via Expo service

### Standalone APK Testing:
1. Build APK: `eas build --platform android --profile production`
2. Install on device
3. Login → Token should be FCM format (long string)
4. Send notification → Should work via Firebase Admin SDK

## ✅ Success Criteria

- [ ] Backend starts without errors
- [ ] Firebase Admin initialized successfully
- [ ] Token registered on login (check database)
- [ ] Notification sent successfully (check backend logs)
- [ ] Notification received on device
- [ ] Tapping notification navigates correctly

## 🚀 Next Steps After Localhost Testing

Once localhost testing works:

1. **Deploy backend to Vercel**
2. **Add `FIREBASE_SERVICE_ACCOUNT` to Vercel environment variables**
3. **Update app's API URL to production**
4. **Test in production environment**


