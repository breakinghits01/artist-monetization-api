import Song from '../models/Song.model';
import Comment from '../models/Comment.model';
import { connectDB } from '../config/database';

async function syncCommentCounts() {
  try {
    // Connect to database
    await connectDB();
    console.log('🔄 Syncing comment counts...');

    const songs = await Song.find({}).select('_id').lean();
    console.log(`📊 Found ${songs.length} songs`);

    let updated = 0;
    for (const song of songs) {
      const commentCount = await Comment.countDocuments({ 
        songId: song._id, 
        deletedAt: null 
      });

      await Song.findByIdAndUpdate(song._id, { 
        commentCount,
        likeCount: 0, // Initialize other counts to 0
        dislikeCount: 0,
        shareCount: 0
      });

      if (commentCount > 0) {
        console.log(`✅ Updated song ${song._id}: ${commentCount} comments`);
        updated++;
      }
    }

    console.log(`\n✨ Done! Updated ${updated} songs with comment counts`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

syncCommentCounts();
