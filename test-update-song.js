#!/usr/bin/env node
/**
 * Test script for PATCH /api/v1/songs/:songId endpoint
 * Tests the song update functionality using child_process (no dependencies needed)
 */

const { execSync } = require('child_process');

// You'll need to replace these with real values from your database
const TEST_DATA = {
  authToken: process.argv[2] || 'YOUR_AUTH_TOKEN_HERE',
  songId: process.argv[3] || 'YOUR_SONG_ID_HERE',
  updates: {
    title: 'Updated Song Title (Test)',
    genre: 'Hip-Hop',
    description: 'This is a test update from the endpoint test script',
    price: 15,
    exclusive: true,
  },
};

const API_BASE = 'http://localhost:3000/api/v1';

async function testUpdateSong() {
  console.log('🧪 Testing PATCH /api/v1/songs/:songId endpoint\n');

  try {
    console.log('📝 Test Data:');
    console.log(`   Song ID: ${TEST_DATA.songId}`);
    console.log(`   Updates:`, JSON.stringify(TEST_DATA.updates, null, 2));
    console.log('');

    // Make PATCH request using curl
    const curlCommand = `curl -X PATCH "${API_BASE}/songs/${TEST_DATA.songId}" \\
      -H "Authorization: Bearer ${TEST_DATA.authToken}" \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(TEST_DATA.updates)}' \\
      -s -w "\\nHTTP_CODE:%{http_code}"`;

    const output = execSync(curlCommand, { encoding: 'utf8' });
    
    // Parse response
    const parts = output.split('\nHTTP_CODE:');
    const responseBody = parts[0];
    const httpCode = parts[1]?.trim();

    console.log(`📡 HTTP Status: ${httpCode}\n`);
    
    if (httpCode === '200') {
      console.log('✅ SUCCESS! Song updated successfully\n');
      console.log('📊 Response:', JSON.parse(responseBody));
      return true;
    } else {
      console.error('❌ ERROR updating song:\n');
      console.error('   Response:', JSON.parse(responseBody));
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR:\n', error.message);
    return false;
  }
}

async function getAuthTokenAndSongId() {
  console.log('📌 Instructions to get test credentials:\n');
  console.log('1. Get Auth Token:');
  console.log('   curl -X POST http://localhost:3000/api/v1/auth/login \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"email":"your@email.com","password":"yourpassword"}\'\n');
  
  console.log('2. Get Song ID:');
  console.log('   curl -X GET "http://localhost:3000/api/v1/songs/artist/YOUR_USER_ID?limit=5" \\');
  console.log('     -H "Authorization: Bearer YOUR_TOKEN"\n');
  
  console.log('3. Run with credentials:');
  console.log('   node test-update-song.js YOUR_TOKEN YOUR_SONG_ID\n');
  console.log('   Or edit TEST_DATA in the script and run: node test-update-song.js\n');
}

// Main execution
if (TEST_DATA.authToken === 'YOUR_AUTH_TOKEN_HERE' || TEST_DATA.songId === 'YOUR_SONG_ID_HERE') {
  getAuthTokenAndSongId();
} else {
  testUpdateSong().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
