# Puppeteer Serverless Configuration Fix

## Problem
Puppeteer can't find Chrome/Chromium in serverless environments (Vercel, AWS Lambda).

## Solution

### For Local Development
Chrome is already installed. It should work locally.

### For Vercel Deployment

Vercel has size limits, so we need to configure Puppeteer properly. Update your `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node",
      "config": {
        "maxLambdaSize": "50mb"
      }
    }
  ],
  "functions": {
    "api/index.ts": {
      "maxDuration": 30
    }
  },
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api",
      "methods": ["GET","POST","PUT","PATCH","OPTIONS","DELETE","HEAD","CONNECT","TRACE"],
      "headers": {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      }
    }
  ]
}
```

### Alternative: Use PDF Generation Service

For production on Vercel, consider using a PDF generation service API instead of Puppeteer:
- Browserless.io
- PDFShift
- HTMLtoPDF API

This avoids the Chromium size issue entirely.

## Current Status

- ✅ Local development: Chrome installed, should work
- ⚠️ Vercel: Needs configuration or alternative solution

