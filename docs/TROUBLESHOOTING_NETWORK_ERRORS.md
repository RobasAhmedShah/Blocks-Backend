# Troubleshooting Network Request Failed Errors

## Problem: "Network request failed" during signup/login

This error occurs when the mobile app cannot reach the backend server. Here's how to fix it.

---

## Quick Checklist

1. ✅ **Backend server is running** (see below)
2. ✅ **Correct API URL for your testing environment** (see below)
3. ✅ **Backend is accessible from your device/emulator**
4. ✅ **CORS is properly configured** (already done in `src/main.ts`)

---

## Step 1: Verify Backend is Running

### Check if backend is running:

```bash
# In the Blocks-Backend directory
npm run start:dev
```

You should see:
```
🚀 App listening on port 3000
```

### Test the endpoint directly:

**Using curl:**
```bash
curl -X POST http://localhost:3000/api/mobile/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User"
  }'
```

**Using the test script:**
```bash
node scripts/test-mobile-api-comprehensive.js
```

If the backend responds, it's working. If not, check:
- Database connection
- Environment variables (`.env` file)
- Port 3000 is not already in use

---

## Step 2: Fix API URL in Mobile App

The **most common issue** is using `localhost` which doesn't work on physical devices or Android emulators.

### For iOS Simulator:
```typescript
// ✅ This works
const API_BASE_URL = 'http://localhost:3000';
```

### For Android Emulator:
```typescript
// ✅ Use this special IP that maps to host machine
const API_BASE_URL = 'http://10.0.2.2:3000';
```

### For Physical Device (Android/iOS):
```typescript
// ✅ Use your computer's local IP address
// Find your IP:
// Windows: ipconfig
// Mac/Linux: ifconfig or ip addr
const API_BASE_URL = 'http://192.168.1.XXX:3000'; // Replace XXX with your IP
```

### For Production:
```typescript
// ✅ Use your deployed backend URL
const API_BASE_URL = 'https://your-backend.vercel.app';
```

---

## Step 3: Find Your Computer's IP Address

### Windows:
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet).

### Mac/Linux:
```bash
ifconfig
# or
ip addr
```
Look for `inet` address (usually starts with `192.168.x.x` or `10.x.x.x`).

---

## Step 4: Update Mobile App Configuration

### Option A: Environment-based Configuration (Recommended)

Create a config file in your mobile app:

**`config/api.ts`** (or similar):
```typescript
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Detect environment
const getApiBaseUrl = () => {
  // Production
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl;
  }

  // Development - use different URLs based on platform
  if (__DEV__) {
    if (Platform.OS === 'android') {
      // Android emulator
      return 'http://10.0.2.2:3000';
    } else {
      // iOS simulator
      return 'http://localhost:3000';
    }
  }

  // Fallback
  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiBaseUrl();
```

### Option B: Use Expo Constants

**`app.json` or `app.config.js`:**
```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://192.168.1.100:3000"  // Your computer's IP
    }
  }
}
```

Then in your code:
```typescript
import Constants from 'expo-constants';
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';
```

---

## Step 5: Verify Network Connectivity

### Test from Mobile App:

Add this test function to verify connectivity:

```typescript
const testConnection = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mobile/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123',
        fullName: 'Test User',
      }),
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
  } catch (error) {
    console.error('Connection test failed:', error);
    console.error('API URL:', API_BASE_URL);
  }
};
```

---

## Step 6: Common Issues & Solutions

### Issue 1: "Network request failed" on Android Emulator

**Solution:** Use `10.0.2.2:3000` instead of `localhost:3000`

```typescript
const API_BASE_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:3000' 
  : 'http://localhost:3000';
```

### Issue 2: "Network request failed" on Physical Device

**Solution:** 
1. Find your computer's IP address (see Step 3)
2. Use that IP instead of `localhost`
3. Make sure your phone and computer are on the same WiFi network
4. Check Windows Firewall isn't blocking port 3000

### Issue 3: Backend responds to curl but not from mobile app

**Possible causes:**
- CORS issue (but CORS is already configured)
- Firewall blocking connections
- Backend only listening on `127.0.0.1` instead of `0.0.0.0`

**Check `src/main.ts`:**
```typescript
// ✅ Should be:
await app.listen(process.env.PORT || 3000, '0.0.0.0');

// ❌ NOT:
await app.listen(process.env.PORT || 3000, '127.0.0.1');
```

### Issue 4: Windows Firewall Blocking

**Solution:**
1. Open Windows Defender Firewall
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Add Node.js or allow port 3000

Or temporarily disable firewall for testing (not recommended for production).

---

## Step 7: Debug Network Requests

### Add detailed logging in your mobile app:

```typescript
const register = async (email: string, password: string, fullName: string) => {
  const url = `${API_BASE_URL}/api/mobile/auth/register`;
  const body = { email, password, fullName };
  
  console.log('🔵 Register Request:');
  console.log('URL:', url);
  console.log('Body:', { ...body, password: '***' }); // Don't log password
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log('✅ Response status:', response.status);
    const data = await response.json();
    console.log('✅ Response data:', data);
    
    return data;
  } catch (error) {
    console.error('❌ Register error:', error);
    console.error('Error details:', {
      message: error.message,
      url: url,
      apiBaseUrl: API_BASE_URL,
    });
    throw error;
  }
};
```

---

## Step 8: Verify Backend Endpoint

The signup endpoint should be:

**Endpoint:** `POST /api/mobile/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "phone": "+1234567890"  // Optional
}
```

**Expected Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "displayCode": "USR-000001",
    "email": "user@example.com",
    "fullName": "John Doe",
    "phone": "+1234567890",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-01-12T10:00:00Z"
  },
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

---

## Quick Test Commands

### Test backend locally:
```bash
# Start backend
npm run start:dev

# In another terminal, test the endpoint
curl -X POST http://localhost:3000/api/mobile/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","fullName":"Test User"}'
```

### Test from mobile app:
1. Ensure backend is running
2. Update API URL in mobile app to match your testing environment
3. Try signup again
4. Check console logs for detailed error messages

---

## Still Not Working?

1. **Check backend logs** - Look for incoming requests in the terminal where `npm run start:dev` is running
2. **Check mobile app logs** - Look for the detailed error in React Native debugger
3. **Verify database connection** - Backend might be failing to connect to database
4. **Check environment variables** - Ensure `.env` file has all required variables
5. **Try a different network** - Sometimes corporate/school networks block local connections

---

## Summary

The most common fix is updating the API URL:
- **iOS Simulator:** `http://localhost:3000` ✅
- **Android Emulator:** `http://10.0.2.2:3000` ✅
- **Physical Device:** `http://YOUR_COMPUTER_IP:3000` ✅

Make sure:
1. Backend is running (`npm run start:dev`)
2. Using the correct URL for your testing environment
3. Phone and computer are on the same network (for physical devices)
4. Firewall allows connections on port 3000


