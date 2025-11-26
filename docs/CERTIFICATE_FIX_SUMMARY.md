# Certificate Generation Fix Summary

## Problem
When making a transaction, the certificate PDF was not being:
1. Generated in Supabase storage
2. Saved to the `certificatePath` field in the investments table

## Root Causes Identified

1. **Supabase Upload Failure**: The upload was set to `upsert: false`, which would fail if a file already existed
2. **Investment Lookup Issues**: The code was searching for investments by userId/propertyId but might not find the correct investment if multiple exist
3. **Error Handling**: Errors during certificate generation were being silently caught without proper logging

## Fixes Applied

### 1. Supabase Upload - Allow Overwriting (`src/supabase/supabase.service.ts`)
- Changed `upsert: false` to `upsert: true` to allow overwriting existing files
- This prevents upload failures when regenerating certificates

### 2. Improved Investment Lookup (`src/certificates/certificates.service.ts`)
- **Priority 1**: Use `investmentId` from the event directly (most reliable)
- **Priority 2**: Fallback to finding by userId/propertyId if investmentId not found
- Added better logging to track which method found the investment

### 3. Enhanced Error Handling (`src/certificates/certificates.service.ts`)
- Added try-catch around Supabase upload with detailed error logging
- Improved error messages to help debug issues
- Added warnings when investment is not found

### 4. Verification in Certificate Listener (`src/listeners/certificate.listener.ts`)
- Added Investment repository injection to verify certificate was saved
- Added verification step after certificate generation to confirm it was saved to the investment table
- Better logging to track the entire certificate generation flow

## Certificate Path Format

The certificate is saved with the following format:
```
transactions/{userId}/{transactionId}.pdf
```

Example:
```
transactions/e886ace6-0d08-4948-9dd7-559e9d3a140f/d8cf01ab-5fba-4085-a220-9b8d0a94a8f7.pdf
```

The full public URL saved in the database:
```
https://klglyxwyrjtjsxfzbzfv.supabase.co/storage/v1/object/public/certificates/transactions/{userId}/{transactionId}.pdf
```

## What Gets Saved

1. **Transaction Table**: `certificatePath` field gets the full public URL
2. **Investment Table**: `certificatePath` field gets the full public URL

## Testing

### 1. Make a Test Transaction
```bash
# Use your mobile app or API to create an investment
POST /api/mobile/investments
```

### 2. Check Backend Logs
Look for these log messages:
```
[CertificateListener] 📨 Event received for investment: ...
[CertificatesService] ☁️ Uploading to Supabase: transactions/{userId}/{transactionId}.pdf
[CertificatesService] ✅ Uploaded to Supabase: ...
[CertificatesService] 🔗 Full public URL: ...
[CertificatesService] 💾 Saved certificate path (full URL) to investment ...
[CertificateListener] ✅ Verified: Certificate path saved to investment ...
```

### 3. Verify in Database
```sql
-- Check transaction table
SELECT id, display_code, certificate_path 
FROM transactions 
WHERE type = 'investment' 
ORDER BY created_at DESC 
LIMIT 5;

-- Check investment table
SELECT id, display_code, certificate_path 
FROM investments 
ORDER BY created_at DESC 
LIMIT 5;
```

### 4. Verify in Supabase Storage
1. Go to Supabase Dashboard → Storage → `certificates` bucket
2. Navigate to `transactions/{userId}/` folder
3. Verify the PDF file exists: `{transactionId}.pdf`

### 5. Test Certificate API
```bash
GET /api/mobile/certificates/transactions/{transactionId}
```

Should return:
```json
{
  "success": true,
  "transactionId": "...",
  "pdfUrl": "https://...signed-url..."
}
```

## Troubleshooting

### Certificate Not Generated
1. Check backend logs for errors
2. Verify Supabase credentials in `.env`:
   ```env
   SUPABASE_URL=https://klglyxwyrjtjsxfzbzfv.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_CERTIFICATES_BUCKET=certificates
   ```
3. Verify the `certificates` bucket exists and is accessible
4. Check that the `investment.completed` event is being emitted

### Certificate Generated but Not Saved to Investment
1. Check logs for: `[CertificatesService] ⚠️ Investment not found`
2. Verify the investmentId is being passed correctly in the event
3. Check database to see if investment exists with the correct userId/propertyId

### Certificate Path is NULL
1. Check if Supabase upload succeeded (look for `✅ Uploaded to Supabase` in logs)
2. Verify the public URL generation is working
3. Check if there are any database save errors

## Files Modified

1. `src/supabase/supabase.service.ts` - Changed upsert to true
2. `src/certificates/certificates.service.ts` - Improved investment lookup and error handling
3. `src/listeners/certificate.listener.ts` - Added verification step

## Next Steps

1. Test with a real transaction
2. Monitor logs to ensure certificates are being generated
3. Verify certificates appear in Supabase storage
4. Confirm certificatePath is saved in both transaction and investment tables


