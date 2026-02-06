import Song from '../models/Song.model';
import User from '../models/User.model';
import dotenv from 'dotenv';
import { connectDB } from '../config/database';

dotenv.config();

const genres = ['Electronic', 'Hip Hop', 'Pop', 'Rock', 'Jazz', 'Ambient', 'EDM'];

const songTitles = [
  'Neon Dreams', 'Cyber Pulse', 'Tokyo Nights', 'Digital Love',
  'Midnight Runner', 'Electric Soul', 'Synthwave Paradise', 'Bassline Paradise',
  'Future Funk', 'Retro Vibes', 'Crystal Skies', 'Urban Legends',
  'Sunset Boulevard', 'Ocean Drive', 'Mountain Echo', 'Phoenix Rising'
];

const descriptions = [
  'A journey through digital soundscapes',
  'Energetic beats with a cyberpunk vibe',
  'Chill vibes for late night listening',
  'Perfect for your workout playlist',
  'Emotional melodies that touch the soul',
  'Upbeat rhythms to brighten your day',
  'Dark ambient textures and deep bass',
  'Feel-good music for any occasion'
];

async function seedSongs() {
  try {
    await connectDB();
    console.log('🌱 Starting song seeding...');

    const artists = await User.find({ role: 'artist' });
    
    if (artists.length === 0) {
      console.log('❌ No artists found. Please create artist accounts first.');
      process.exit(1);
    }

    console.log(`Found ${artists.length} artists`);
    await Song.deleteMany({});
    console.log('🗑️ Cleared existing songs');

    const songs = [];
    
    for (let i = 0; i < songTitles.length; i++) {
      const artist = artists[i % artists.length];
      const genre = genres[Math.floor(Math.random() * genres.length)];
      const price = [10, 15, 20, 25, 30][Math.floor(Math.random() * 5)];
      const duration = 180 + Math.floor(Math.random() * 180);
      const playCount = Math.floor(Math.random() * 10000);
      const exclusive = Math.random() > 0.7;
      const featured = Math.random() > 0.8;

      songs.push({
        artistId: artist._id,
        title: songTitles[i],
        duration,
        price,
        coverArt: `https://picsum.photos/seed/song${i}/300/300`,
        audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 16) + 1}.mp3`,
        exclusive,
        genre,
        description: descriptions[i % descriptions.length],
        playCount,
        featured,
      });
    }

    await Song.insertMany(songs);
    console.log(`✅ Successfully created ${songs.length} songs`);

    const summary = await Song.aggregate([
      { $group: { _id: '$genre', count: { $sum: 1 } } },
    ]);

    console.log('\n📊 Songs by genre:');
    summary.forEach((item) => {
      console.log(`  ${item._id}: ${item.count} songs`);
    });

    console.log('\n🎉 Seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedSongs();
