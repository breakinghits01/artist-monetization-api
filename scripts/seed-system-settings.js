/**
 * Database Migration Script: Seed System Settings
 * 
 * This script initializes the SystemSettings collection with default values.
 * Run this once after deploying the new settings feature.
 * 
 * Usage: node scripts/seed-system-settings.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  type: { type: String, enum: ['string', 'number', 'boolean', 'json'], required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['general', 'upload', 'security', 'monetization', 'system'], default: 'general' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const SystemSettings = mongoose.model('SystemSettings', settingsSchema);

// Default settings to seed
const defaultSettings = [
  {
    key: 'max_songs_per_artist',
    value: 10,
    type: 'number',
    description: 'Maximum number of songs an artist can upload',
    category: 'upload'
  },
  {
    key: 'enforce_song_limit',
    value: true,
    type: 'boolean',
    description: 'Enable or disable song upload limit enforcement',
    category: 'upload'
  },
  {
    key: 'upload_size_limit_mb',
    value: 50,
    type: 'number',
    description: 'Maximum file size for song uploads (in MB)',
    category: 'upload'
  },
  {
    key: 'allowed_audio_formats',
    value: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'],
    type: 'json',
    description: 'List of allowed audio file formats for upload',
    category: 'upload'
  },
  {
    key: 'min_song_duration_seconds',
    value: 30,
    type: 'number',
    description: 'Minimum duration for uploaded songs (in seconds)',
    category: 'upload'
  },
  {
    key: 'max_song_duration_seconds',
    value: 600,
    type: 'number',
    description: 'Maximum duration for uploaded songs (in seconds, 10 minutes)',
    category: 'upload'
  },
  {
    key: 'enable_audio_conversion',
    value: true,
    type: 'boolean',
    description: 'Convert uploaded audio to standardized format (MP3 320kbps)',
    category: 'system'
  },
  {
    key: 'default_song_price',
    value: 100,
    type: 'number',
    description: 'Default price for new songs (in tokens)',
    category: 'monetization'
  },
  {
    key: 'maintenance_mode',
    value: false,
    type: 'boolean',
    description: 'Enable maintenance mode (blocks all non-admin requests)',
    category: 'system'
  },
  {
    key: 'require_email_verification',
    value: true,
    type: 'boolean',
    description: 'Require users to verify email before uploading',
    category: 'security'
  }
];

async function seedSettings() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic_artist_monetization');
    console.log('✅ Connected to MongoDB');

    console.log('\n📦 Seeding system settings...');
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const setting of defaultSettings) {
      const existing = await SystemSettings.findOne({ key: setting.key });
      
      if (existing) {
        console.log(`⏭️  Skipping existing setting: ${setting.key}`);
        skipped++;
      } else {
        await SystemSettings.create(setting);
        console.log(`✅ Created setting: ${setting.key} = ${JSON.stringify(setting.value)}`);
        created++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📦 Total: ${defaultSettings.length}`);

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n💡 You can now manage these settings from the CMS admin panel.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the migration
seedSettings();
