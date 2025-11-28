# LocalTunnel Setup - Quick Guide

## ✅ Installed!

I've installed `localtunnel` for you. Now follow these steps:

## Step 1: Start the Tunnel

**Open a NEW terminal window** and run:

```bash
cd Blocks-Backend
lt --port 3000
```

You'll see output like:
```
your url is: https://random-name-123.loca.lt
```

**Copy the HTTPS URL** (e.g., `https://random-name-123.loca.lt`)

## Step 2: Update `.env` File

Open `Blocks-Backend/.env` and update:

```env
# Change from:
API_URL=http://localhost:3000

# To (use your localtunnel URL):
API_URL=https://random-name-123.loca.lt
```

**Important:** 
- Use the **HTTPS** URL
- Make sure there's no trailing slash

## Step 3: Restart Backend

```bash
# Stop current server (Ctrl+C)
npm start
```

## Step 4: Test

Now distribute ROI - it should work! 🎉

---

## 🔄 Keep Tunnel Running

**Important:** Keep the terminal with `lt --port 3000` running while testing.

If you close it, you'll get a new URL next time - just update `.env` again.

---

## 🎯 Quick Commands

**Start tunnel:**
```bash
lt --port 3000
```

**Or use the script:**
```bash
.\start-tunnel.ps1
```

---

## ✅ Verification

After updating `.env` and restarting, you should see:

1. **Backend logs:**
   ```
   ✅ QStash configured with API URL: https://random-name-123.loca.lt
   ```

2. **No more errors** when distributing ROI

3. **Notifications queued successfully**

---

## 🐛 Troubleshooting

**Problem:** Tunnel URL changes
- **Solution:** Update `API_URL` in `.env` and restart backend

**Problem:** "Connection refused"
- **Solution:** Make sure backend is running on port 3000

**Problem:** Still getting localhost error
- **Solution:** 
  1. Check `.env` has correct tunnel URL
  2. Restart backend after updating `.env`
  3. Verify tunnel is still running

---

## 📝 Alternative: Use ngrok (Manual Download)

If you prefer ngrok:

1. **Download:** https://ngrok.com/download
2. **Extract** to a folder
3. **Run:** `ngrok.exe http 3000`
4. **Copy HTTPS URL** from ngrok
5. **Update `.env`:** `API_URL=https://your-ngrok-url.ngrok.io`

---

**Ready to test!** 🚀


