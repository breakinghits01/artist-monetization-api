import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Song from '../models/Song.model';

dotenv.config();

/**
 * Migration Script: Add Audio Format Fields to Existing Songs
 * 
 * This script safely adds default values for new audio format and download fields
 * to all existing songs in the database.
 * 
 * BACKWARD COMPATIBLE - Safe to run multiple times (idempotent)
 * 
 * Usage:
 *   npm run migrate:audio-fields              # Run actual migration
 *   npm run migrate:audio-fields -- --dry-run # Preview changes without updating
 */

interface MigrationStats {
  total: number;
  updated: number;
  alreadyMigrated: number;
  errors: number;
}

async function migrateSongAudioFields(dryRun: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    alreadyMigrated: 0,
    errors: 0,
  };

  try {
    console.log('🔍 Checking songs for migration...\n');

    // Find all songs that don't have the new fields
    const songs = await Song.find({
      $or: [
        { audioFormat: { $exists: false } },
        { downloadEnabled: { $exists: false } },
        { downloadCount: { $exists: false } },
        { downloadFormats: { $exists: false } },
      ],
    });

    stats.total = songs.length;

    if (stats.total === 0) {
      console.log('✅ All songs are already migrated!');
      return stats;
    }

    console.log(`Found ${stats.total} songs to migrate\n`);

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Migrate each song
    for (const song of songs) {
      try {
        const updates: any = {};

        // Add audio format fields if missing
        if (!song.audioFormat) {
          updates.audioFormat = 'mp3';
        }
        if (!song.audioBitrate) {
          updates.audioBitrate = 320;
        }
        // Note: audioFileSize, originalAudioUrl, etc. remain undefined (optional)

        // Add download fields if missing
        if (song.downloadEnabled === undefined) {
          updates.downloadEnabled = true;
        }
        if (!song.downloadCount) {
          updates.downloadCount = 0;
        }
        if (!song.downloadFormats || song.downloadFormats.length === 0) {
          updates.downloadFormats = ['mp3'];
        }
        if (song.premiumDownloadOnly === undefined) {
          updates.premiumDownloadOnly = false;
        }

        if (Object.keys(updates).length > 0) {
          if (!dryRun) {
            await Song.updateOne({ _id: song._id }, { $set: updates });
            stats.updated++;
            console.log(`✅ Updated: ${song.title} (${song._id})`);
          } else {
            stats.updated++;
            console.log(`[DRY RUN] Would update: ${song.title} (${song._id})`);
            console.log(`          Fields: ${Object.keys(updates).join(', ')}`);
          }
        } else {
          stats.alreadyMigrated++;
        }
      } catch (error) {
        stats.errors++;
        console.error(`❌ Error updating song ${song._id}:`, error);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total songs checked: ${stats.total}`);
    console.log(`   Updated: ${stats.updated}`);
    console.log(`   Already migrated: ${stats.alreadyMigrated}`);
    console.log(`   Errors: ${stats.errors}`);

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run flag to apply changes');
    } else {
      console.log('\n✅ Migration complete!');
    }

    return stats;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function main() {
  try {
    // Check for dry-run flag
    const isDryRun = process.argv.includes('--dry-run');

    console.log('🚀 Song Audio Fields Migration\n');
    console.log('Connecting to MongoDB...');

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/artist-monetization';
    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB\n');

    // Run migration
    const stats = await migrateSongAudioFields(isDryRun);

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');

    // Exit with appropriate code
    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  main();
}

export { migrateSongAudioFields };
