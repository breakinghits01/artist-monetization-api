const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define Song schema
const SongSchema = new Schema({
  artistId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  duration: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0, default: 10 },
  coverArt: { type: String, default: null },
  audioUrl: { type: String, required: true },
  exclusive: { type: Boolean, default: false },
  genre: { type: String, trim: true },
  description: { type: String, maxlength: 500 },
  playCount: { type: Number, default: 0, min: 0 },
  featured: { type: Boolean, default: false },
}, { timestamps: true });

const Song = mongoose.model('Song', SongSchema);

mongoose.connect('mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin').then(async () => {
  
  // Find all "Sandali lang" songs
  const duplicates = await Song.find({ 
    artistId: '6982bda1b7a73570da690db9',
    title: 'Sandali lang' 
  }).sort({ createdAt: 1 });
  
  console.log(`Found ${duplicates.length} "Sandali lang" songs`);
  
  if (duplicates.length > 1) {
    // Keep the newest one, delete the older one(s)
    const toDelete = duplicates.slice(0, -1);
    
    for (const song of toDelete) {
      console.log(`🗑️ Deleting: ${song.title} (${song.createdAt}) - ${song.audioUrl}`);
      await Song.findByIdAndDelete(song._id);
    }
    
    console.log(`✅ Kept newest: ${duplicates[duplicates.length - 1].title} (${duplicates[duplicates.length - 1].createdAt})`);
  } else {
    console.log('ℹ️ No duplicates found');
  }
  
  await mongoose.disconnect();
  console.log('✅ Done!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
