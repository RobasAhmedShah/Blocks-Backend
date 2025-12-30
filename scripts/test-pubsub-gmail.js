/**
 * Test script for Gmail Pub/Sub webhook endpoint
 * 
 * Usage: node scripts/test-pubsub-gmail.js
 */

const http = require('http');

// Test message data (what Gmail sends)
const gmailEvent = {
  emailAddress: 'test@gmail.com',
  historyId: '123456789'
};

// Base64 encode the message data
const messageData = Buffer.from(JSON.stringify(gmailEvent)).toString('base64');

// Pub/Sub message format
const pubSubMessage = {
  message: {
    data: messageData,
    messageId: 'test-message-' + Date.now(),
    publishTime: new Date().toISOString()
  },
  subscription: 'projects/blocks-1b5ba/subscriptions/gmail-deposit-push-sub'
};

const postData = JSON.stringify(pubSubMessage);

// Backend runs on port 3001 by default (or PORT env variable)
const PORT = process.env.PORT || 3001;

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/api/pubsub/gmail',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing Gmail Pub/Sub webhook endpoint...\n');
console.log(`📤 Sending request to: http://localhost:${PORT}/api/pubsub/gmail\n`);
console.log('📦 Message data:', JSON.stringify(gmailEvent, null, 2));
console.log('📦 Base64 encoded:', messageData);
console.log('\n');

const req = http.request(options, (res) => {
  console.log(`📥 Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`📋 Headers:`, res.headers);
  console.log('\n');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📨 Response body:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }
    
    console.log('\n');
    if (res.statusCode === 200) {
      console.log('✅ Test passed! Check your backend console for logs.');
    } else {
      console.log('❌ Test failed! Status code:', res.statusCode);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  console.error(`\n💡 Troubleshooting:`);
  console.error(`   1. Make sure your backend is running: npm run start:dev`);
  console.error(`   2. Check if backend is on port ${PORT} (default is 3001, not 3000)`);
  console.error(`   3. Check backend console for: "🚀 App listening on port ${PORT}"`);
  console.error(`   4. Try: curl http://localhost:${PORT}/api/pubsub/gmail`);
  console.error(`\n   Error code: ${e.code}`);
  if (e.code === 'ECONNREFUSED') {
    console.error(`   → Connection refused - backend is not running on port ${PORT}`);
  }
});

req.write(postData);
req.end();

