const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/artist_monetization';

// Playlist Schema
const playlistSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  coverImage: String,
  isPublic: { type: Boolean, default: true },
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  songCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Playlist = mongoose.model('Playlist', playlistSchema);

const fixPlaylistOwnership = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const frederickUserId = '6982bda1b7a73570da690db9';
    const rawAge1UserId = '69a93a9b209cb094ace6edbb';

    // Find the 2 playlists that should belong to RawAge1
    const playlistsToFix = await Playlist.find({
      userId: frederickUserId,
      name: { $in: ['Fucking heart & Soul', 'NEO-SOUL'] }
    });

    console.log(`📋 Found ${playlistsToFix.length} playlists to fix:\n`);
    
    for (const playlist of playlistsToFix) {
      console.log(`   - "${playlist.name}" (ID: ${playlist._id})`);
      console.log(`     Current userId: ${playlist.userId}`);
      console.log(`     Songs count: ${playlist.songCount}`);
      console.log(`     Created: ${playlist.createdAt}`);
      console.log('');
    }

    if (playlistsToFix.length === 0) {
      console.log('⚠️  No playlists found to fix.');
      process.exit(0);
    }

    // Update the userId to RawAge1
    const result = await Playlist.updateMany(
      {
        userId: frederickUserId,
        name: { $in: ['Fucking heart & Soul', 'NEO-SOUL'] }
      },
      {
        $set: { userId: rawAge1UserId, updatedAt: new Date() }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} playlists`);
    console.log(`   Changed userId from ${frederickUserId} (Frederick)`);
    console.log(`   to ${rawAge1UserId} (RawAge1)\n`);

    // Verify the fix
    const frederickPlaylists = await Playlist.find({ userId: frederickUserId });
    const rawAge1Playlists = await Playlist.find({ userId: rawAge1UserId });

    console.log('📊 Final playlist counts:');
    console.log(`   Frederick (${frederickUserId}): ${frederickPlaylists.length} playlists`);
    frederickPlaylists.forEach(p => console.log(`      - ${p.name}`));
    
    console.log(`\n   RawAge1 (${rawAge1UserId}): ${rawAge1Playlists.length} playlists`);
    rawAge1Playlists.forEach(p => console.log(`      - ${p.name}`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing playlist ownership:', error);
    process.exit(1);
  }
};

fixPlaylistOwnership();
