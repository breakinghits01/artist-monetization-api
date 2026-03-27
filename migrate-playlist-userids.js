const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/artist_monetization';

/**
 * Migration Script: Convert Playlist userId from String to ObjectId
 * 
 * This script:
 * 1. Finds all playlists with string userId
 * 2. Converts them to ObjectId
 * 3. Updates the database
 * 
 * Safe to run multiple times (only processes string userIds)
 */

const migratePlaylistUserIds = async () => {
  try {
    console.log('🔄 Starting Playlist userId migration...\n');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get raw collection (bypass schema)
    const db = mongoose.connection.db;
    const playlistsCollection = db.collection('playlists');

    // Find all playlists
    const allPlaylists = await playlistsCollection.find({}).toArray();
    console.log(`📊 Total playlists found: ${allPlaylists.length}\n`);

    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const playlist of allPlaylists) {
      try {
        const userIdType = typeof playlist.userId;
        
        if (userIdType === 'string') {
          console.log(`🔄 Converting playlist: "${playlist.name}"`);
          console.log(`   Current userId (string): ${playlist.userId}`);
          
          // Validate string format before conversion
          if (!mongoose.Types.ObjectId.isValid(playlist.userId)) {
            console.log(`   ❌ Invalid ObjectId format, skipping\n`);
            errors++;
            continue;
          }

          // Convert string to ObjectId
          const objectIdUserId = new mongoose.Types.ObjectId(playlist.userId);
          
          // Update the document
          const result = await playlistsCollection.updateOne(
            { _id: playlist._id },
            { $set: { userId: objectIdUserId } }
          );

          if (result.modifiedCount > 0) {
            console.log(`   ✅ Converted to ObjectId: ${objectIdUserId}`);
            console.log(`   Modified: ${result.modifiedCount} document\n`);
            converted++;
          } else {
            console.log(`   ⚠️  No changes made\n`);
          }
        } else if (userIdType === 'object' && playlist.userId instanceof mongoose.Types.ObjectId) {
          console.log(`⏭️  Skipping playlist: "${playlist.name}" (already ObjectId)\n`);
          skipped++;
        } else {
          console.log(`⚠️  Unknown userId type for "${playlist.name}": ${userIdType}\n`);
          errors++;
        }
      } catch (err) {
        console.error(`❌ Error processing playlist "${playlist.name}":`, err.message, '\n');
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Converted:  ${converted} playlists`);
    console.log(`⏭️  Skipped:    ${skipped} playlists (already ObjectId)`);
    console.log(`❌ Errors:     ${errors} playlists`);
    console.log(`📊 Total:      ${allPlaylists.length} playlists`);
    console.log('='.repeat(60));

    if (converted > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('👉 Next steps:');
      console.log('   1. Update Playlist model: userId: ObjectId');
      console.log('   2. Remove .toString() from createPlaylist');
      console.log('   3. Rebuild and restart API');
    } else if (skipped === allPlaylists.length) {
      console.log('\n✅ All playlists already use ObjectId format!');
    } else {
      console.log('\n⚠️  Migration completed with issues. Please review errors above.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

// Run migration
migratePlaylistUserIds();
