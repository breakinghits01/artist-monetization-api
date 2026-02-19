#!/usr/bin/env node

/**
 * Migration Script: Update Placeholder Images
 * 
 * Purpose: Replace broken via.placeholder.com URLs with reliable SVG data URI
 * Created: 2026-02-19
 * 
 * This script updates all songs that use via.placeholder.com with a base64-encoded
 * SVG placeholder that works offline and has no CORS issues.
 */

const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/artist-monetization-db';

// SVG placeholder - music note icon on dark background
const DEFAULT_COVER_ART = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM5YzI3YjA7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOTFlYzc7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNnKSIvPjxnIG9wYWNpdHk9IjAuMyI+PHBhdGggZD0iTTE1MCw4MGMyNywwLDUwLDIyLDUwLDUwczAsNTAtNTAsNTBzLTUwLTIyLTUwLTUwUzEyMyw4MCwxNTAsODBaIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTE1MCwxMTBjMTEsMCwyMCw5LDIwLDIwczAsMjAtMjAsMjBzLTIwLTktMjAtMjBTMTM5LDExMCwxNTAsMTEwWiIgZmlsbD0iIzljMjdiMCIvPjxwYXRoIGQ9Ik0xNTAsMjAwYy0yNywwLTUwLTIyLTUwLTUwczIzLTUwLDUwLTUwczUwLDIyLDUwLDUwUzE3NywyMDAsMTUwLDIwMFptMC04MGMtMTEsMC0yMCw5LTIwLDIwczksyDAsMjAsMjAtOSwyMC0yMFMxNjEsMTM5LDE1MCwxMjBaIiBmaWxsPSIjZmZmIi8+PC9nPjwvc3ZnPg==';

async function migrate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Song = mongoose.model('Song', new mongoose.Schema({}, { strict: false }));

    // Find all songs using via.placeholder.com
    console.log('\n🔍 Searching for songs with via.placeholder.com...');
    const songsToUpdate = await Song.find({
      coverArt: { $regex: /via\.placeholder/i }
    });

    console.log(`📊 Found ${songsToUpdate.length} songs to update:`);
    songsToUpdate.forEach(song => {
      console.log(`   - ${song.title} (ID: ${song._id})`);
      console.log(`     Current: ${song.coverArt}`);
    });

    if (songsToUpdate.length === 0) {
      console.log('\n✨ No songs need updating. All good!');
      return;
    }

    // Update all songs
    console.log('\n🔄 Updating songs...');
    const result = await Song.updateMany(
      { coverArt: { $regex: /via\.placeholder/i } },
      { $set: { coverArt: DEFAULT_COVER_ART } }
    );

    console.log(`\n✅ Migration complete!`);
    console.log(`   - Songs matched: ${result.matchedCount}`);
    console.log(`   - Songs updated: ${result.modifiedCount}`);

    // Verify the update
    console.log('\n🔍 Verifying update...');
    const remainingSongs = await Song.find({
      coverArt: { $regex: /via\.placeholder/i }
    });

    if (remainingSongs.length === 0) {
      console.log('✅ Verification passed - no songs with via.placeholder.com found');
    } else {
      console.log(`⚠️  Warning: ${remainingSongs.length} songs still have via.placeholder.com`);
    }

    // Show sample of updated songs
    console.log('\n📋 Sample updated songs:');
    const updatedSongs = await Song.find({
      coverArt: DEFAULT_COVER_ART
    }).limit(3);
    
    updatedSongs.forEach(song => {
      console.log(`   ✓ ${song.title}`);
      console.log(`     New coverArt: ${song.coverArt.substring(0, 60)}...`);
    });

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n🎉 Migration script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
