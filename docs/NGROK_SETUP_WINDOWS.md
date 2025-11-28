# ngrok Setup for Windows - Step by Step

## 🔴 Problem: LocalTunnel Unavailable

Localtunnel can be unreliable. Let's use **ngrok** instead - it's more stable and doesn't require passwords.

## ✅ Solution: Use ngrok

### Step 1: Download ngrok

1. **Go to:** https://ngrok.com/download
2. **Download:** Windows version (zip file)
3. **Extract** the zip file to a folder (e.g., `C:\ngrok\`)

### Step 2: Add ngrok to PATH (Optional but Recommended)

1. **Copy ngrok.exe** to a folder like `C:\ngrok\`
2. **Add to PATH:**
   - Press `Win + R`
   - Type: `sysdm.cpl` and press Enter
   - Go to **Advanced** tab → **Environment Variables**
   - Under **System Variables**, find **Path** → **Edit**
   - Click **New** → Add: `C:\ngrok`
   - Click **OK** on all dialogs

**OR** just use the full path when running ngrok.

### Step 3: Start ngrok

**Open a NEW terminal** and run:

```bash
# If added to PATH:
ngrok http 3000

# OR if not in PATH, use full path:
C:\ngrok\ngrok.exe http 3000
```

You'll see:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Step 4: Update `.env` File

Open `Blocks-Backend/.env` and update:

```env
API_URL=https://abc123.ngrok.io
```

(Use your actual ngrok URL)

### Step 5: Restart Backend

```bash
# Stop current server (Ctrl+C)
npm start
```

### Step 6: Test

Now distribute ROI - it should work! 🎉

---

## 🔍 Verify Backend is Running

Before starting ngrok, make sure your backend is running:

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000
```

If you see output, backend is running. If not, start it:

```bash
cd Blocks-Backend
npm start
```

---

## ✅ ngrok Advantages

- ✅ No password required
- ✅ More reliable than localtunnel
- ✅ Free tier available
- ✅ Better for production testing
- ✅ Web interface to see requests

---

## 🎯 Quick Commands

**Start ngrok:**
```bash
ngrok http 3000
```

**View ngrok dashboard:**
Open: http://127.0.0.1:4040 (shows all requests)

**Stop ngrok:**
Press `Ctrl+C` in the ngrok terminal

---

## 🐛 Troubleshooting

**Problem:** "ngrok not found"
- **Solution:** Use full path: `C:\ngrok\ngrok.exe http 3000`

**Problem:** "Port 3000 already in use"
- **Solution:** Make sure backend is running on port 3000

**Problem:** "Tunnel unavailable"
- **Solution:** 
  1. Make sure backend is running
  2. Restart ngrok
  3. Check firewall isn't blocking

---

## 📝 Summary

1. **Download ngrok** from https://ngrok.com/download
2. **Extract** to a folder
3. **Run:** `ngrok.exe http 3000` (or add to PATH first)
4. **Copy HTTPS URL**
5. **Update `.env`:** `API_URL=https://your-ngrok-url.ngrok.io`
6. **Restart backend**
7. **Test!**

ngrok is much more reliable than localtunnel! 🚀


