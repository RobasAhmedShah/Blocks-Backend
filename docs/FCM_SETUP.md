# FCM (Firebase Cloud Messaging) Setup Guide

## Problem
When FCM is configured in EAS, the app generates raw FCM tokens instead of Expo push tokens. Expo's push service cannot send to raw FCM tokens, so we need to use Firebase Admin SDK directly.

## Solution
The backend now supports both:
1. **Expo Push Tokens** → Sent via Expo Push Service
2. **FCM Tokens** → Sent directly via Firebase Admin SDK

## Setup Instructions

### Step 1: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (e.g., `blocks-1b5ba`)
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Download the JSON file (e.g., `blocks-1b5ba-firebase-adminsdk-fbsvc-9decb41279.json`)

### Step 2: Set Environment Variable

You have two options:

#### Option A: JSON String (Recommended for Vercel)
Convert the JSON file to a single-line string and set it as an environment variable:

```bash
# In your .env file (for local development)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"blocks-1b5ba",...}'
```

**For Vercel:**
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add new variable:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** Paste the entire JSON content as a single line (remove all newlines)
   - **Environment:** Production, Preview, Development (select all)

#### Option B: File Path (Local Development Only)
If running locally, you can also set the path to the JSON file:

```bash
# In your .env file
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/firebase-adminsdk.json
```

**Note:** This only works locally. For production (Vercel), you must use Option A.

### Step 3: Restart Backend

After setting the environment variable, restart your backend server:

```bash
# Local
npm run start:dev

# Or if using PM2
pm2 restart blocks-backend
```

### Step 4: Verify Setup

Check backend logs on startup. You should see:

```
[NotificationsService] Firebase Admin initialized for FCM notifications
```

If you see a warning instead:
```
[NotificationsService] FIREBASE_SERVICE_ACCOUNT not configured - FCM notifications will not work for standalone builds
```

Then the environment variable is not set correctly.

## How It Works

### Token Detection
The backend automatically detects token type:

1. **Expo Token:** `ExponentPushToken[xxxxxxxxxxxxxx]`
   - Sent via Expo Push Service
   - Works in Expo Go and standalone builds (when Expo routing is used)

2. **FCM Token:** `fkqKu_lGRZyf_qVtp-wRFO:APA91bF...`
   - Long string with colons
   - Sent directly via Firebase Admin SDK
   - Required for standalone APK builds with FCM configured

### Notification Flow

```
1. User logs in → App generates token
2. Token sent to backend → Stored in users.expoToken
3. Admin sends notification → Backend detects token type
4. If FCM token → Sent via Firebase Admin SDK
5. If Expo token → Sent via Expo Push Service
```

## Testing

### Test 1: Check Token Type in Database
```sql
SELECT 
  id, 
  email, 
  LEFT("expoToken", 50) as token_preview,
  CASE 
    WHEN "expoToken" LIKE 'ExponentPushToken[%' THEN 'Expo'
    WHEN "expoToken" LIKE '%:%' AND LENGTH("expoToken") > 50 THEN 'FCM'
    ELSE 'Unknown'
  END as token_type
FROM users 
WHERE "expoToken" IS NOT NULL;
```

### Test 2: Send Test Notification
1. Login to app (token should be registered)
2. Send notification from admin panel
3. Check backend logs:
   - For FCM: `📤 Sending FCM push notification to user...`
   - For Expo: `📤 Sending Expo push notification to user...`
   - Success: `✅ FCM notification sent successfully...` or `✅ Expo notification sent successfully...`

### Test 3: Verify Notification Received
- Check device for notification
- Tap notification → Should navigate to correct page

## Troubleshooting

### Issue: "FIREBASE_SERVICE_ACCOUNT not configured"
**Solution:** 
- Check environment variable is set correctly
- For Vercel, ensure JSON is on a single line (no newlines)
- Restart backend after setting variable

### Issue: "Failed to initialize Firebase Admin"
**Solution:**
- Check JSON format is valid
- Ensure all required fields are present in service account JSON
- Check backend logs for specific error message

### Issue: "Invalid registration token" or "registration-token-not-registered"
**Solution:**
- Token is invalid or device uninstalled app
- Backend automatically removes invalid tokens
- User needs to login again to register new token

### Issue: Notifications work in Expo Go but not in standalone APK
**Solution:**
- Ensure FCM credentials are configured in EAS: `eas credentials`
- Rebuild APK after configuring FCM
- Check that `FIREBASE_SERVICE_ACCOUNT` is set in backend environment

## Environment Variables Summary

```env
# Required for FCM notifications (standalone builds)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Required for Expo notifications (Expo Go)
# No additional config needed - Expo SDK handles it

# Required for Web Push notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=admin@yourapp.com

# Required for notification queueing
QSTASH_TOKEN=...
API_URL=https://your-app.vercel.app
```

## Notes

- **Expo Go:** Uses Expo push tokens → Sent via Expo service
- **Standalone APK with FCM:** Uses FCM tokens → Sent via Firebase Admin SDK
- **Both methods work:** Backend automatically detects and uses the correct method
- **No app changes needed:** App continues to use `getExpoPushTokenAsync()` - backend handles the rest


