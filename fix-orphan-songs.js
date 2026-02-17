const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define Song schema matching the model
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
  
  // Create record for first Sandali lang upload (13:43)
  const song1 = await Song.create({
    artistId: '6982bda1b7a73570da690db9',
    title: 'Sandali lang',
    duration: 240,
    price: 10,
    coverArt: 'https://via.placeholder.com/300',
    audioUrl: '/uploads/Sandali lang-1771306976555-949540040.mp3',
    exclusive: false,
    genre: 'Pop',
    description: '',
    playCount: 0,
    featured: false,
    createdAt: new Date('2026-02-17T13:43:38Z')
  });
  
  console.log('✅ Created song 1:', song1._id, '-', song1.title);
  
  // Create record for second Sandali lang upload (13:54)
  const song2 = await Song.create({
    artistId: '6982bda1b7a73570da690db9',
    title: 'Sandali lang',
    duration: 240,
    price: 10,
    coverArt: 'https://via.placeholder.com/300',
    audioUrl: '/uploads/Sandali lang-1771307639094-470218481.mp3',
    exclusive: false,
    genre: 'Pop',
    description: '',
    playCount: 0,
    featured: false,
    createdAt: new Date('2026-02-17T13:54:33Z')
  });
  
  console.log('✅ Created song 2:', song2._id, '-', song2.title);
  
  await mongoose.disconnect();
  console.log('✅ Done! Refresh your app to see both "Sandali lang" songs.');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
