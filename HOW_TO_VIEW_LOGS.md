# How to View Backend Logs

## 📍 Where to See Logs

The backend logs appear in the **terminal/console** where you started the backend server.

## 🚀 Steps to View Logs

### 1. **Find Your Backend Terminal Window**

If you're running the backend with:
```bash
npm run start:dev

```

The logs will appear in **that same terminal window**.

### 2. **What You'll See**

When you make an investment, you should see logs like this:

```
[InvestmentsService] ✅ Investment completed event emitted for user USR-000001, transaction: TXN-000123
[CertificateListener] 📨 Event received for investment: INV-000456, userId: abc-123, propertyId: xyz-789
[CertificateListener] ✅ Found transaction: TXN-000123 (abc-123-def-456)
[CertificatesService] 🔄 Generating transaction certificate for: abc-123-def-456
[CertificatesService] 📄 Starting PDF generation for transaction TXN-000123
[CertificatesService] 🎨 Rendering HTML template...
[CertificatesService] 📄 Generating PDF from HTML...
[CertificatesService] 📦 PDF generated (123456 bytes)
[CertificatesService] ☁️ Uploading to Supabase: transactions/user-id/transaction-id.pdf
[CertificatesService] ✅ Uploaded to Supabase: transactions/user-id/transaction-id.pdf
[CertificatesService] 💾 Saved certificate path to database: transactions/user-id/transaction-id.pdf
[CertificatesService] ✅ Transaction certificate generated successfully: transactions/user-id/transaction-id.pdf
[CertificateListener] ✅ Certificate generated successfully for transaction TXN-000123: transactions/user-id/transaction-id.pdf
```

### 3. **If You Don't See the Terminal**

**Option A: Check if backend is running**
- Look for a terminal/command prompt window
- It should show something like: `Nest application successfully started on http://localhost:3000`

**Option B: Start the backend in a new terminal**
1. Open a new terminal/command prompt
2. Navigate to the backend folder:
   ```bash
   cd Blocks-Backend
   ```
3. Start the backend:
   ```bash
   npm run start:dev
   ```
4. Keep this terminal window open - all logs will appear here

### 4. **Filter Logs (Optional)**

If there are too many logs, you can filter for certificate-related logs:

**On Windows (PowerShell):**
```powershell
npm run start:dev | Select-String -Pattern "Certificate|Investment|Supabase"
```

**On Mac/Linux:**
```bash
npm run start:dev | grep -E "Certificate|Investment|Supabase"
```

## 🔍 What to Look For

### ✅ **Good Signs:**
- `[InvestmentsService] ✅ Investment completed event emitted`
- `[CertificateListener] 📨 Event received`
- `[CertificateListener] ✅ Found transaction`
- `[CertificatesService] ✅ Uploaded to Supabase`
- `[CertificatesService] ✅ Transaction certificate generated successfully`

### ❌ **Bad Signs:**
- `[CertificateListener] ❌ No transaction found`
- `[CertificatesService] ❌ Error generating certificate`
- `Failed to upload certificate to Supabase`
- `Transaction not found`

## 📝 Quick Test

1. **Make sure backend is running:**
   ```bash
   cd Blocks-Backend
   npm run start:dev
   ```

2. **Make an investment** from your mobile app

3. **Watch the terminal** - you should see the logs appear in real-time

4. **Look for the success messages** listed above

## 🐛 If You Don't See Any Logs

1. **Check if backend is actually running:**
   - Look for: `Nest application successfully started`
   - Try accessing: `http://localhost:3000` in your browser

2. **Check if you're looking at the right terminal:**
   - Make sure it's the terminal where you ran `npm run start:dev`
   - Not the terminal for the mobile app or database

3. **Restart the backend:**
   - Press `Ctrl+C` to stop
   - Run `npm run start:dev` again
   - Make another investment

## 💡 Pro Tip

Keep the backend terminal window visible and watch it while testing. The logs will appear in real-time as you make investments!

