require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin';

async function checkSongUrls() {
  try {
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    const Song = mongoose.model('Song', new mongoose.Schema({}, { strict: false }));

    const songs = await Song.find({}, { title: 1, audioUrl: 1, playCount: 1 }).lean();

    console.log(`📊 Found ${songs.length} songs:\n`);
    console.log('='.repeat(80));

    songs.forEach(song => {
      const isR2 = song.audioUrl.includes('.r2.dev') || song.audioUrl.includes('.r2.cloudflarestorage.com');
      const isLocal = song.audioUrl.startsWith('/uploads/');
      const storageType = isR2 ? '☁️  R2' : isLocal ? '💾 Local' : '🌐 External';
      
      console.log(`${storageType} | "${song.title}" | Plays: ${song.playCount || 0}`);
      console.log(`     ${song.audioUrl}`);
      console.log('');
    });

    console.log('='.repeat(80));
    
    const r2Count = songs.filter(s => s.audioUrl.includes('.r2.dev')).length;
    const localCount = songs.filter(s => s.audioUrl.startsWith('/uploads/')).length;
    
    console.log('\n📈 Summary:');
    console.log(`   ☁️  R2 Storage: ${r2Count} songs`);
    console.log(`   💾 Local Storage: ${localCount} songs`);
    console.log(`   🌐 Other: ${songs.length - r2Count - localCount} songs\n`);

    await mongoose.disconnect();
    console.log('✅ Done');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkSongUrls();
