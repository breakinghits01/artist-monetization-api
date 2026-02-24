/**
 * Migration Script: Initialize Engagement Fields
 * Adds default engagement fields to all existing songs
 */

import mongoose from 'mongoose';
import Song from '../models/Song.model';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/artist_monetization';

async function migrateEngagementFields() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Update all songs that don't have engagement fields
    // Using $setOnInsert pattern would be safer, but updateMany doesn't support it
    // So we check for null/undefined explicitly
    const result = await Song.updateMany(
      {
        $or: [
          { likeCount: { $exists: false } },
          { likeCount: null },
          { dislikeCount: { $exists: false } },
          { commentCount: { $exists: false } },
          { shareCount: { $exists: false } },
        ],
      },
      {
        $set: {
          likeCount: 0,
          dislikeCount: 0,
          commentCount: 0,
          shareCount: 0,
          averageRating: 0,
          ratingCount: 0,
          engagementScore: 0,
          engagementUpdatedAt: null,
        },
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} songs with engagement fields`);

    // Show sample of updated songs
    const samples = await Song.find()
      .select('title playCount likeCount commentCount shareCount')
      .limit(5);

    console.log('\n📊 Sample songs after migration:');
    samples.forEach((song) => {
      console.log(`- ${song.title}: playCount=${song.playCount}, likeCount=${song.likeCount}, commentCount=${song.commentCount}`);
    });

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateEngagementFields();
