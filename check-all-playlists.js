const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/artist_monetization';

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

const checkAllPlaylists = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const frederickUserId = '6982bda1b7a73570da690db9';
    const rawAge1UserId = '69a93a9b209cb094ace6edbb';

    // Get ALL playlists
    const allPlaylists = await Playlist.find({}).lean();
    
    console.log(`📊 Total playlists in database: ${allPlaylists.length}\n`);

    console.log('📋 Frederick\'s playlists (userId: ' + frederickUserId + '):');
    const frederickPlaylists = allPlaylists.filter(p => p.userId === frederickUserId);
    console.log(`   Count: ${frederickPlaylists.length}`);
    frederickPlaylists.forEach(p => {
      console.log(`   - "${p.name}" (${p.songCount} songs) - Created: ${p.createdAt}`);
    });

    console.log('\n📋 RawAge1\'s playlists (userId: ' + rawAge1UserId + '):');
    const rawAge1Playlists = allPlaylists.filter(p => p.userId === rawAge1UserId);
    console.log(`   Count: ${rawAge1Playlists.length}`);
    rawAge1Playlists.forEach(p => {
      console.log(`   - "${p.name}" (${p.songCount} songs) - Created: ${p.createdAt}`);
    });

    console.log('\n📋 Other users\' playlists:');
    const otherPlaylists = allPlaylists.filter(p => 
      p.userId !== frederickUserId && p.userId !== rawAge1UserId
    );
    console.log(`   Count: ${otherPlaylists.length}`);
    otherPlaylists.forEach(p => {
      console.log(`   - "${p.name}" (userId: ${p.userId}) - ${p.songCount} songs`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkAllPlaylists();
