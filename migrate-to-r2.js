/**
 * Migration Script: Upload existing local songs to Cloudflare R2
 * This script:
 * 1. Finds all songs with local /uploads/ URLs
 * 2. Uploads them to R2
 * 3. Updates the database with new R2 URLs
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'artist-monetization-audio';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// S3 Client for R2
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin';

// Upload file to R2
async function uploadFileToR2(filePath, fileName, contentType) {
  const fileBuffer = fs.readFileSync(filePath);
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: `audio/${fileName}`,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await r2Client.send(command);
  return `${R2_PUBLIC_URL}/audio/${fileName}`;
}

// Get MIME type from file extension
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/m4a',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

async function migrateSongs() {
  try {
    console.log('🚀 Starting migration to R2...\n');

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get Song model
    const Song = mongoose.model('Song', new mongoose.Schema({}, { strict: false }));

    // Find all songs with local /uploads/ URLs
    const songsToMigrate = await Song.find({
      audioUrl: { $regex: '^/uploads/' }
    });

    console.log(`📊 Found ${songsToMigrate.length} songs to migrate\n`);

    if (songsToMigrate.length === 0) {
      console.log('✅ No songs to migrate. All done!');
      await mongoose.disconnect();
      return;
    }

    const uploadsDir = path.join(__dirname, 'uploads');
    let successCount = 0;
    let failCount = 0;

    for (const song of songsToMigrate) {
      try {
        // Extract filename from URL (e.g., /uploads/song-123.mp3 -> song-123.mp3)
        const filename = song.audioUrl.replace('/uploads/', '');
        const localPath = path.join(uploadsDir, filename);

        console.log(`📤 Migrating: ${song.title}`);
        console.log(`   Local: ${filename}`);

        // Check if file exists
        if (!fs.existsSync(localPath)) {
          console.log(`   ⚠️  File not found locally, skipping...\n`);
          failCount++;
          continue;
        }

        // Get file stats
        const stats = fs.statSync(localPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   Size: ${sizeInMB} MB`);

        // Upload to R2
        const contentType = getContentType(filename);
        const r2Url = await uploadFileToR2(localPath, filename, contentType);
        console.log(`   R2 URL: ${r2Url}`);

        // Update database
        await Song.updateOne(
          { _id: song._id },
          { $set: { audioUrl: r2Url } }
        );

        console.log(`   ✅ Migrated successfully!\n`);
        successCount++;

      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   Total songs: ${songsToMigrate.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('='.repeat(50) + '\n');

    if (successCount > 0) {
      console.log('🎉 Migration complete! Songs are now on Cloudflare R2.');
      console.log('💡 Old files in uploads/ folder can be deleted after verification.');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateSongs();
