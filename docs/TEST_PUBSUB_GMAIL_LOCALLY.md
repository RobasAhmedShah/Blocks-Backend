# Testing Gmail Pub/Sub Webhook Locally

## Quick Test (No Pub/Sub Required)

You can test the endpoint locally by simulating the Pub/Sub message format.

### Step 1: Start Your Backend

```bash
cd Blocks-Backend
npm run start:dev
```

You should see:
```
🚀 App listening on port 3000
```

### Step 2: Test with curl (Windows PowerShell)

```powershell
# Create the test message
$messageData = '{"emailAddress":"test@gmail.com","historyId":"123456789"}'
$base64Data = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($messageData))

# Send the request
curl -X POST http://localhost:3000/api/pubsub/gmail `
  -H "Content-Type: application/json" `
  -d "{\"message\":{\"data\":\"$base64Data\",\"messageId\":\"test-123\",\"publishTime\":\"2025-01-27T10:00:00.000Z\"},\"subscription\":\"projects/blocks-1b5ba/subscriptions/gmail-deposit-push-sub\"}"
```

### Step 2: Test with curl (Linux/Mac)

```bash
# Create the test message
MESSAGE_DATA='{"emailAddress":"test@gmail.com","historyId":"123456789"}'
BASE64_DATA=$(echo -n "$MESSAGE_DATA" | base64)

# Send the request
curl -X POST http://localhost:3000/api/pubsub/gmail \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"data\": \"$BASE64_DATA\",
      \"messageId\": \"test-123\",
      \"publishTime\": \"2025-01-27T10:00:00.000Z\"
    },
    \"subscription\": \"projects/blocks-1b5ba/subscriptions/gmail-deposit-push-sub\"
  }"
```

### Step 3: Check Your Console

You should see in your terminal:

```
📩 Gmail Push Received: {
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiJ0ZXN0QGdtYWlsLmNvbSIsImhpc3RvcnlJZCI6IjEyMzQ1Njc4OSJ9",
    "messageId": "test-123",
    "publishTime": "2025-01-27T10:00:00.000Z"
  },
  "subscription": "projects/blocks-1b5ba/subscriptions/gmail-deposit-push-sub"
}
[GmailService] Gmail event received: {
  emailAddress: 'test@gmail.com',
  historyId: '123456789',
  messageId: 'test-123',
  publishTime: '2025-01-27T10:00:00.000Z',
  subscription: 'projects/blocks-1b5ba/subscriptions/gmail-deposit-push-sub'
}
```

### Step 4: Verify Response

You should get a `200 OK` response:

```json
{
  "success": true,
  "message": "Gmail event processed successfully"
}
```

---

## Using HTTP File (VS Code REST Client)

If you have the REST Client extension in VS Code, you can use `test-pubsub-gmail.http`:

1. Open `test-pubsub-gmail.http`
2. Click "Send Request" above the POST request
3. Check the response and your console logs

---

## Testing with Actual Pub/Sub (Advanced)

If you want to test with **real Google Cloud Pub/Sub**, you need to:

### Step 1: Expose Local Server to Internet

Use **ngrok** or **localtunnel**:

```bash
# Option 1: ngrok (recommended)
ngrok http 3000

# Option 2: localtunnel
lt --port 3000
```

You'll get a public URL like: `https://abc123.ngrok.io`

### Step 2: Update Pub/Sub Push Subscription

In Google Cloud Console:

1. Go to Pub/Sub → Subscriptions
2. Edit your `gmail-deposit-push-sub` subscription
3. Update push endpoint to: `https://abc123.ngrok.io/api/pubsub/gmail`
4. Save

### Step 3: Send Test Email

Send an email to the watched Gmail inbox.

### Step 4: Check Logs

- **Local console**: Should show the webhook being hit
- **ngrok dashboard**: http://127.0.0.1:4040 (shows all requests)

---

## Troubleshooting

### Problem: "Cannot POST /api/pubsub/gmail"

**Solution**: Make sure your backend is running on port 3000:
```bash
npm run start:dev
```

### Problem: No logs appearing

**Solution**: 
1. Check the endpoint path is correct: `/api/pubsub/gmail`
2. Check Content-Type header is `application/json`
3. Verify the request body format matches Pub/Sub format

### Problem: "Property 'data' does not exist"

**Solution**: This is a TypeScript error. Make sure you've built the project:
```bash
npm run build
```

### Problem: Want to test with real Pub/Sub but ngrok URL changes

**Solution**: 
- Use ngrok with a reserved domain (paid plan)
- Or use localtunnel with a subdomain: `lt --port 3000 --subdomain blocks-backend`
- Or deploy to Vercel for stable testing

---

## Next Steps

Once you confirm the endpoint is working locally:

1. ✅ **Deploy to Vercel**
2. ✅ **Update Pub/Sub subscription** to point to Vercel URL
3. ✅ **Send test email** to watched Gmail inbox
4. ✅ **Check Vercel logs** for the webhook call

Then proceed to Step 2 (fetching Gmail history)!

