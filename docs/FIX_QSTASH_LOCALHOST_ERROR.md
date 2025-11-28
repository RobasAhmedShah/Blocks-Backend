# Fix QStash Localhost Error

## 🔴 Error

```
QstashError: {"error":"invalid destination url: endpoint resolves to a loopback address: ::1"}
```

## 🔍 Problem

**QStash cannot reach `localhost:3000`** because:
- `localhost` resolves to a loopback address (`127.0.0.1` or `::1`)
- QStash servers are on the internet and cannot access your local machine
- QStash needs a **publicly accessible URL** to call your endpoint

## ✅ Solution: Use ngrok for Local Testing

### Step 1: Install ngrok

```bash
npm install -g ngrok
```

Or download from: https://ngrok.com/download

### Step 2: Start ngrok

In a **new terminal window**, run:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Step 3: Update `.env` File

Open `Blocks-Backend/.env` and update:

```env
# Change from:
API_URL=http://localhost:3000

# To (use your ngrok URL):
API_URL=https://abc123.ngrok.io
```

**Important:** Use the **HTTPS** URL from ngrok, not HTTP.

### Step 4: Restart Backend

```bash
# Stop current server (Ctrl+C)
npm start
```

### Step 5: Test Again

Now when you distribute ROI, QStash will be able to reach your server through ngrok!

---

## 🎯 Quick Setup Script

**Option 1: Manual (Recommended)**
1. Start ngrok: `ngrok http 3000`
2. Copy HTTPS URL
3. Update `.env`: `API_URL=https://your-ngrok-url.ngrok.io`
4. Restart backend

**Option 2: Keep ngrok running**
- Keep the ngrok terminal open while testing
- If ngrok restarts, you'll get a new URL - update `.env` again

---

## 📝 Alternative: Skip QStash for Local Testing (Not Recommended)

If you just want to test the notification logic without QStash, you can temporarily call the process endpoint directly, but this defeats the purpose of testing the async queue system.

**Better approach:** Use ngrok - it's free and takes 2 minutes to set up.

---

## 🚀 Production Deployment

When deployed to Vercel:
- `VERCEL_URL` will be automatically set
- QStash will work without ngrok
- No configuration needed!

---

## ✅ Verification

After setting up ngrok and updating `.env`, you should see:

1. **Backend logs:**
   ```
   ✅ QStash configured with API URL: https://abc123.ngrok.io
   ```

2. **No more errors** when distributing ROI:
   ```
   ✅ Notification queued for user [userId]
   ```

3. **QStash dashboard** shows jobs being processed

---

## 🐛 Troubleshooting

**Problem:** ngrok URL changes every time
- **Solution:** Use ngrok's static domain (paid feature) or update `.env` each time

**Problem:** ngrok connection drops
- **Solution:** Restart ngrok and update `API_URL` in `.env`

**Problem:** Still getting localhost error
- **Solution:** 
  1. Check `.env` has correct ngrok URL
  2. Restart backend after updating `.env`
  3. Verify ngrok is still running

---

## 📋 Summary

1. **Error:** QStash can't reach `localhost:3000`
2. **Fix:** Use ngrok to expose localhost to internet
3. **Steps:**
   - Install ngrok: `npm install -g ngrok`
   - Start: `ngrok http 3000`
   - Copy HTTPS URL
   - Update `.env`: `API_URL=https://your-ngrok-url.ngrok.io`
   - Restart backend
4. **Test:** Distribute ROI - should work now!

---

**Note:** This is only needed for **local testing**. In production (Vercel), QStash will work automatically! 🎉


