# Push Notifications Implementation

## Overview

This document describes the push notifications feature implementation for the Blocks backend. The system supports both **Expo Push Notifications** (for React Native mobile apps) and **Web Push Notifications** (for Next.js web apps).

## Feature Summary

When an admin distributes rewards to a property:
1. Backend identifies all users who own that property
2. Creates notification jobs in a BullMQ queue for each user
3. A worker service processes jobs and sends push notifications:
   - **Expo Push** → React Native app users
   - **Web Push** → Next.js web users
4. All notifications are logged in the database for tracking

### Key Benefits
- ✅ Async, non-blocking notification delivery
- ✅ Scalable (handles thousands of notifications)
- ✅ Reliable with retry logic
- ✅ Delivery tracking and logging
- ✅ Fast API response times

---

## Architecture

### Components

1. **NotificationsService** - Queues notification jobs
2. **NotificationWorker** - Processes jobs and sends push notifications
3. **NotificationsController** - Handles token registration endpoints
4. **BullMQ Queue** - Job queue for async processing
5. **Notification Entity** - Database records of sent notifications

### Data Flow

```
Reward Distribution → RewardsService → NotificationsService → BullMQ Queue
                                                                    ↓
                                                          NotificationWorker
                                                                    ↓
                                    ┌───────────────────────────────┴───────────────┐
                                    ↓                                               ↓
                            Expo Push API                                  Web Push API
                                    ↓                                               ↓
                            React Native App                              Next.js Web App
```

---

## Database Schema

### Users Table (Updated)
- `expoToken` (TEXT, nullable) - Expo push token for mobile apps
- `webPushSubscription` (TEXT, nullable) - Web Push subscription JSON for web apps

### Notifications Table (New)
- `id` (UUID) - Primary key
- `userId` (UUID) - Foreign key to users (CASCADE DELETE)
- `title` (VARCHAR) - Notification title
- `message` (TEXT) - Notification message
- `data` (JSONB) - Additional payload data
- `status` (VARCHAR) - 'pending', 'sent', or 'failed'
- `platform` (VARCHAR) - 'expo' or 'web'
- `createdAt` (TIMESTAMPTZ) - Timestamp

---

## Setup Instructions

### 1. Install Dependencies

Already installed:
- `bullmq` - Job queue
- `ioredis` - Redis client
- `expo-server-sdk` - Expo push notifications
- `web-push` - Web Push API

### 2. Database Migration

Run the migration on your Neon database branch:

```bash
# Connect to your Neon branch
psql 'postgresql://neondb_owner:npg_hI8EYzein0WC@ep-soft-resonance-a1frot6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# Run the migration
\i database/migrations/add-push-notifications.sql
```

Or use the migration script:
```bash
npm run migrate
```

### 3. Environment Variables

Add these to your `.env` file:

```env
# Redis Configuration (required for BullMQ)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Web Push VAPID Keys (required for web push notifications)
# Generate using: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=admin@yourapp.com
```

### 4. Start Redis

**Using Docker:**
```bash
docker run -d -p 6379:6379 redis
```

**Using Docker Desktop (Windows):**
- Open Docker Desktop
- Run: `docker run -d -p 6379:6379 redis`

**Local Redis:**
```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

### 5. Start the Application

The notification worker starts automatically when the NestJS app starts:

```bash
npm run start:dev
```

You should see:
```
[NotificationsModule] Notification queue initialized
[NotificationWorker] Notification worker started
```

---

## API Endpoints

### Register Expo Token (Mobile App)

**POST** `/api/notifications/register-expo-token`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Body:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Expo token registered successfully"
}
```

### Register Web Push Subscription (Web App)

**POST** `/api/notifications/register-web-push`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Web push subscription registered successfully"
}
```

### Get User Notifications

**GET** `/api/notifications`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "Reward Credited",
      "message": "A new reward of 10.500000 USDT has been added...",
      "data": {
        "type": "reward",
        "rewardId": "uuid",
        "propertyId": "uuid",
        "amountUSDT": "10.500000"
      },
      "status": "sent",
      "platform": "expo",
      "createdAt": "2025-01-XXT..."
    }
  ]
}
```

---

## How It Works

### Reward Distribution Flow

1. Admin calls `POST /api/rewards/distribute-roi` with property ID and total ROI
2. `RewardsService.distributeRoi()`:
   - Finds all users who invested in the property
   - Distributes rewards to each user's wallet
   - **Queues a notification job for each user**
3. `NotificationWorker` processes jobs:
   - Fetches user's push tokens from database
   - Sends Expo push (if `expoToken` exists)
   - Sends Web push (if `webPushSubscription` exists)
   - Saves notification record to database

### Notification Job Structure

```typescript
{
  userId: string,
  title: string,
  message: string,
  data?: {
    type: 'reward',
    rewardId: string,
    propertyId: string,
    amountUSDT: string,
    // ... other data
  }
}
```

---

## Frontend Integration

### React Native (Expo)

```typescript
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

// Register for push notifications
useEffect(() => {
  registerForPushNotifications();
}, []);

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = await Notifications.getExpoPushTokenAsync();
  
  // Send to backend
  await fetch('https://your-api.com/api/notifications/register-expo-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: token.data }),
  });
}
```

### Next.js (Web Push)

```typescript
// Generate VAPID keys: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

async function registerWebPush() {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Send to backend
  await fetch('https://your-api.com/api/notifications/register-web-push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscription }),
  });
}
```

---

## Configuration

### BullMQ Queue Settings

- **Concurrency**: 10 jobs processed simultaneously
- **Retry Attempts**: 3 attempts with exponential backoff
- **Job Retention**: 
  - Completed jobs: 24 hours or max 1000 jobs
  - Failed jobs: 7 days

### Worker Settings

- **Expo**: Automatically chunks large batches
- **Web Push**: Handles invalid subscriptions (removes them)
- **Error Handling**: Logs errors but doesn't crash the worker

---

## Monitoring & Debugging

### Check Queue Status

```typescript
// In your code
const queue = createNotificationQueue(configService);
const waiting = await queue.getWaiting();
const active = await queue.getActive();
const completed = await queue.getCompleted();
const failed = await queue.getFailed();
```

### View Notifications in Database

```sql
-- Recent notifications
SELECT * FROM notifications 
ORDER BY "createdAt" DESC 
LIMIT 50;

-- Failed notifications
SELECT * FROM notifications 
WHERE status = 'failed';

-- Notifications by user
SELECT * FROM notifications 
WHERE "userId" = 'user-uuid-here';
```

### Logs

The worker logs all activities:
- `Notification queued for user {userId}`
- `Expo notification sent to user {userId}`
- `Web push notification sent to user {userId}`
- `Failed to send...` (with error details)

---

## Troubleshooting

### Notifications Not Sending

1. **Check Redis is running:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check worker is running:**
   - Look for `[NotificationWorker] Notification worker started` in logs

3. **Check user has tokens:**
   ```sql
   SELECT id, email, "expoToken", "webPushSubscription" 
   FROM users 
   WHERE id = 'user-uuid';
   ```

4. **Check queue has jobs:**
   - Look for `Notification queued for user...` in logs

### Invalid Tokens

The worker automatically removes invalid tokens:
- Expo: Removes tokens when `DeviceNotRegistered` error occurs
- Web Push: Removes subscriptions when status 410 or 404

### Redis Connection Issues

- Ensure Redis is accessible at the configured host/port
- Check firewall settings
- Verify `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` in `.env`

---

## Future Enhancements

- [ ] Notification preferences per user
- [ ] Notification templates
- [ ] Batch notification sending
- [ ] Notification history API with pagination
- [ ] Push notification analytics
- [ ] Scheduled notifications
- [ ] Rich notifications with images/actions

---

## Files Created/Modified

### New Files
- `src/notifications/entities/notification.entity.ts`
- `src/notifications/dto/create-notification-job.dto.ts`
- `src/notifications/dto/register-expo-token.dto.ts`
- `src/notifications/dto/register-web-push.dto.ts`
- `src/notifications/bullmq/bullmq.config.ts`
- `src/notifications/notifications.service.ts`
- `src/notifications/notifications.controller.ts`
- `src/notifications/notification.worker.ts`
- `src/notifications/notifications.module.ts`
- `database/migrations/add-push-notifications.sql`

### Modified Files
- `src/admin/entities/user.entity.ts` - Added `expoToken` and `webPushSubscription`
- `src/rewards/rewards.service.ts` - Added notification queuing
- `src/rewards/rewards.module.ts` - Imported NotificationsModule
- `src/app.module.ts` - Added NotificationsModule
- `package.json` - Added dependencies

---

## Support

For issues or questions, check:
1. Worker logs for error messages
2. Database notification records for delivery status
3. Redis queue status for pending jobs
4. User tokens in database for registration status

