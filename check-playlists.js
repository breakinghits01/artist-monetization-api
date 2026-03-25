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

const checkPlaylists = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const frederickUserId = '6982bda1b7a73570da690db9';
    const rawAge1UserId = '69a93a9b209cb094ace6edbb';

    console.log('🔍 Searching for "my fav" playlist...\n');
    
    const myFavPlaylist = await Playlist.findOne({ name: 'my fav' });
    
    if (myFavPlaylist) {
      console.log('📋 Found "my fav" playlist:');
      console.log(`   ID: ${myFavPlaylist._id}`);
      console.log(`   Name: ${myFavPlaylist.name}`);
      console.log(`   UserId: ${myFavPlaylist.userId}`);
      console.log(`   SongCount: ${myFavPlaylist.songCount}`);
      console.log(`   Created: ${myFavPlaylist.createdAt}`);
      
      if (myFavPlaylist.userId === frederickUserId) {
        console.log('\n   ✅ Belongs to Frederick (CORRECT)');
      } else if (myFavPlaylist.userId === rawAge1UserId) {
        console.log('\n   ❌ Belongs to RawAge1 (WRONG - should be Frederick!)');
      } else {
        console.log(`\n   ❌ Belongs to unknown user: ${myFavPlaylist.userId}`);
      }
    } else {
      console.log('❌ "my fav" playlist not found!');
    }

    console.log('\n\n📊 All playlists in database:\n');
    const allPlaylists = await Playlist.find({});
    
    for (const playlist of allPlaylists) {
      console.log(`   - "${playlist.name}"`);
      console.log(`     ID: ${playlist._id}`);
      console.log(`     UserId: ${playlist.userId}`);
      console.log(`     Owner: ${playlist.userId === frederickUserId ? 'Frederick' : playlist.userId === rawAge1UserId ? 'RawAge1' : 'Unknown'}`);
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkPlaylists();
