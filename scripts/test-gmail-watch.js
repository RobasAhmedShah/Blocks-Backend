/**
 * Test Gmail Watch Renewal Endpoint
 * 
 * Usage: node scripts/test-gmail-watch.js
 */

const http = require('http');

const PORT = process.env.PORT || 3001;
const ENDPOINT = '/api/gmail/watch/renew';

console.log('🧪 Testing Gmail Watch Renewal Endpoint\n');
console.log(`📍 Endpoint: http://localhost:${PORT}${ENDPOINT}`);
console.log(`⏳ Waiting for backend to be ready...\n`);

// Wait a bit for backend to start
setTimeout(() => {
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
  };

  const postData = JSON.stringify({}); // Send empty JSON object

  const req = http.request(options, (res) => {
    let data = '';

    console.log(`📊 Status Code: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    console.log('\n📦 Response Body:\n');

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log(JSON.stringify(json, null, 2));
        
        if (json.success) {
          console.log('\n✅ SUCCESS! Gmail watch was started/renewed.');
          if (json.expiration) {
            console.log(`   Expiration: ${json.expiration}`);
          }
          if (json.historyId) {
            console.log(`   History ID: ${json.historyId}`);
          }
        } else {
          console.log('\n❌ FAILED!');
          if (json.error) {
            console.log(`   Error: ${json.error}`);
          }
        }
      } catch (e) {
        console.log(data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request Error:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Backend is running (npm run start:dev)');
    console.error(`   2. Backend is listening on port ${PORT}`);
    console.error(`   3. Endpoint exists: ${ENDPOINT}`);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.error('❌ Request Timeout');
    req.destroy();
    process.exit(1);
  });

  req.write(postData); // Write the empty JSON body
  req.end();
}, 5000); // Wait 5 seconds for backend to start

