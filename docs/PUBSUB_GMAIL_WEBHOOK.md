# Gmail Pub/Sub Webhook Endpoint

## Overview

This endpoint receives Gmail events from Google Cloud Pub/Sub when Gmail events occur (e.g., new emails, label changes).

## Endpoint

**URL**: `/api/pubsub/gmail`  
**Method**: `POST`  
**Authentication**: None (public endpoint)  
**Content-Type**: `application/json`

## Pub/Sub Message Format

Google Cloud Pub/Sub sends messages in the following format:

```json
{
  "message": {
    "data": "base64-encoded-json-string",
    "messageId": "1234567890",
    "publishTime": "2025-01-27T10:00:00.000Z"
  },
  "subscription": "projects/blocks-1b5ba/subscriptions/gmail-deposit-push-sub"
}
```

The `data` field contains a base64-encoded JSON string that decodes to:

```json
{
  "emailAddress": "user@gmail.com",
  "historyId": "123456789"
}
```

## Response

The endpoint always returns `200 OK` to acknowledge message receipt, even if processing fails. This prevents Pub/Sub from retrying the message.

**Success Response** (200):
```json
{
  "success": true,
  "message": "Gmail event processed successfully"
}
```

**Error Response** (200):
```json
{
  "success": false,
  "message": "Error processing webhook, but message acknowledged"
}
```

## Implementation Details

### Files Created

- `src/pubsub/pubsub.module.ts` - Pub/Sub module
- `src/pubsub/gmail/gmail.controller.ts` - Webhook controller
- `src/pubsub/gmail/gmail.service.ts` - Message processing service
- `src/pubsub/gmail/dto/pubsub-message.dto.ts` - DTOs for message structure

### Processing Flow

1. Pub/Sub sends POST request to `/api/pubsub/gmail`
2. Controller receives the message
3. Service decodes base64 `data` field
4. Service parses JSON to extract Gmail event
5. Service validates required fields (`emailAddress`, `historyId`)
6. Service logs the event
7. Controller returns 200 status with success response

### Error Handling

- All errors are caught and logged
- Endpoint always returns 200 to prevent Pub/Sub retries
- Missing or invalid data is logged but doesn't cause failures

## Usage

### Testing with curl

```bash
# Create a test message
MESSAGE_DATA='{"emailAddress":"test@gmail.com","historyId":"123456789"}'
BASE64_DATA=$(echo -n "$MESSAGE_DATA" | base64)

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

## Next Steps

The endpoint is ready for Pub/Sub push subscription creation. After creating the subscription, you can:

1. Add email processing logic in `GmailService.processPubSubMessage()`
2. Add database operations to store email events
3. Add email parsing to extract deposit information
4. Add validation for specific email addresses or patterns
5. Add event emission for other services to react to Gmail events

## Google Cloud Pub/Sub Setup

To create the push subscription:

```bash
gcloud pubsub subscriptions create gmail-deposit-push-sub \
  --topic=gmail-events \
  --push-endpoint=https://your-domain.com/api/pubsub/gmail \
  --ack-deadline=60
```

Make sure the endpoint is publicly accessible and returns 200 status codes.

