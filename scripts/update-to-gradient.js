#!/usr/bin/env node

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin';

// Beautiful gradient placeholder
const GRADIENT_COVER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM5YzI3YjA7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOTFlYzc7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNnKSIvPjxnIG9wYWNpdHk9IjAuMyI+PHBhdGggZD0iTTE1MCw4MGMyNywwLDUwLDIyLDUwLDUwczAsNTAtNTAsNTBzLTUwLTIyLTUwLTUwUzEyMyw4MCwxNTAsODBaIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTE1MCwxMTBjMTEsMCwyMCw5LDIwLDIwczAsMjAtMjAsMjBzLTIwLTktMjAtMjBTMTM5LDExMCwxNTAsMTEwWiIgZmlsbD0iIzljMjdiMCIvPjxwYXRoIGQ9Ik0xNTAsMjAwYy0yNywwLTUwLTIyLTUwLTUwczIzLTUwLDUwLTUwczUwLDIyLDUwLDUwUzE3NywyMDAsMTUwLDIwMFptMC04MGMtMTEsMC0yMCw5LTIwLDIwczksyDAsMjAsMjAtOSwyMC0yMFMxNjEsMTM5LDE1MCwxMjBaIiBmaWxsPSIjZmZmIi8+PC9nPjwvc3ZnPg==';

async function migrate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected');

    const Song = mongoose.model('Song', new mongoose.Schema({}, { strict: false }));

    // Update all songs with data URI (old gray SVG)
    const result = await Song.updateMany(
      { coverArt: { $regex: /^data:image/ } },
      { $set: { coverArt: GRADIENT_COVER } }
    );

    console.log(`✅ Updated ${result.modifiedCount} songs with beautiful gradient placeholder`);
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

migrate();
