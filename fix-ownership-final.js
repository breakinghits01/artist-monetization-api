const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/artist_monetization';

const playlistSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.Mixed, // Accept both String and ObjectId
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

const fixOwnership = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const frederickUserId = '6982bda1b7a73570da690db9';
    const rawAge1UserId = '69a93a9b209cb094ace6edbb';

    // Find playlists that need fixing
    const playlists = await Playlist.find({}).lean();
    
    console.log('📋 Current playlists:\n');
    for (const p of playlists) {
      console.log(`   "${p.name}"`);
      console.log(`      userId: ${p.userId} (type: ${typeof p.userId})`);
      console.log(`      songs: ${p.songCount}`);
      console.log('');
    }

    // Fix "Fucking heart & Soul" and "NEO-SOUL" to belong to RawAge1
    const result = await Playlist.updateMany(
      { name: { $in: ['Fucking heart & Soul', 'NEO-SOUL'] } },
      { $set: { userId: rawAge1UserId, updatedAt: new Date() } }
    );

    console.log(`✅ Updated ${result.modifiedCount} playlists to RawAge1\n`);

    // Verify
    const frederickCount = await Playlist.countDocuments({ userId: frederickUserId });
    const rawAge1Count = await Playlist.countDocuments({ userId: rawAge1UserId });

    console.log('📊 Final counts:');
    console.log(`   Frederick: ${frederickCount} playlists`);
    console.log(`   RawAge1: ${rawAge1Count} playlists`);

    const updatedPlaylists = await Playlist.find({}).lean();
    console.log('\n📋 Verification:');
    for (const p of updatedPlaylists) {
      console.log(`   "${p.name}" → userId: ${p.userId}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixOwnership();
