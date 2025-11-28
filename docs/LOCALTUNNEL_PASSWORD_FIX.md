# Fix LocalTunnel Password Prompt

## 🔴 Problem

Localtunnel is asking for a password when QStash tries to access your endpoint.

## ✅ Solution: Use Subdomain (No Password)

### Option 1: Use Subdomain (Recommended)

**Stop the current tunnel** (Ctrl+C) and restart with a subdomain:

```bash
lt --port 3000 --subdomain blocks-backend
```

This will give you a URL like: `https://blocks-backend.loca.lt` (no password needed!)

**Note:** If the subdomain is taken, try a different one:
```bash
lt --port 3000 --subdomain blocks-backend-123
```

### Option 2: Set a Password and Use It

If you want to use a password:

1. **Start tunnel with password:**
   ```bash
   lt --port 3000 --subdomain blocks-backend --open false
   ```

2. **Get the password** from the terminal output

3. **Update your endpoint URL** to include the password:
   ```
   https://blocks-backend.loca.lt?password=YOUR_PASSWORD
   ```

But this is more complex - **Option 1 is better!**

---

## 🎯 Quick Fix Steps

1. **Stop current tunnel** (Ctrl+C in the tunnel terminal)

2. **Start with subdomain:**
   ```bash
   lt --port 3000 --subdomain blocks-backend
   ```

3. **Copy the URL** (e.g., `https://blocks-backend.loca.lt`)

4. **Update `.env`:**
   ```env
   API_URL=https://blocks-backend.loca.lt
   ```

5. **Restart backend**

6. **Test** - should work without password! 🎉

---

## 🔄 Alternative: Use ngrok (No Password)

If localtunnel keeps giving issues, use ngrok:

1. **Download ngrok:** https://ngrok.com/download
2. **Extract** the zip file
3. **Run:** `ngrok.exe http 3000`
4. **Copy HTTPS URL** (e.g., `https://abc123.ngrok.io`)
5. **Update `.env`:** `API_URL=https://abc123.ngrok.io`

ngrok doesn't require passwords and is more reliable.

---

## ✅ Verification

After using subdomain, QStash should be able to access your endpoint without password prompts!


