import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISystemSettings extends Document {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  category: string;
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

// Interface for static methods
export interface ISystemSettingsModel extends Model<ISystemSettings> {
  getSetting(key: string, defaultValue?: any): Promise<any>;
  updateSetting(
    key: string,
    value: any,
    updatedBy?: mongoose.Types.ObjectId
  ): Promise<ISystemSettings | null>;
  clearCache(): void;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'json'],
      required: true,
      default: 'string',
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['general', 'upload', 'security', 'monetization', 'system'],
      default: 'general',
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
SystemSettingsSchema.index({ category: 1, key: 1 });
SystemSettingsSchema.index({ updatedAt: -1 });

// Cache settings in memory for performance (5 minute TTL)
let settingsCache: Map<string, { value: any; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get setting value with caching
 */
SystemSettingsSchema.statics.getSetting = async function (
  key: string,
  defaultValue?: any
): Promise<any> {
  // Check cache first
  const cached = settingsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  // Fetch from database
  const setting = await this.findOne({ key });
  
  if (!setting) {
    return defaultValue;
  }

  // Update cache
  settingsCache.set(key, {
    value: setting.value,
    timestamp: Date.now(),
  });

  return setting.value;
};

/**
 * Update setting value and clear cache
 */
SystemSettingsSchema.statics.updateSetting = async function (
  key: string,
  value: any,
  updatedBy?: mongoose.Types.ObjectId
): Promise<ISystemSettings | null> {
  const updated = await this.findOneAndUpdate(
    { key },
    { value, updatedBy, updatedAt: new Date() },
    { new: true, upsert: false }
  );

  // Clear cache entry
  settingsCache.delete(key);

  return updated;
};

/**
 * Clear entire settings cache
 */
SystemSettingsSchema.statics.clearCache = function (): void {
  settingsCache.clear();
};

export default mongoose.model<ISystemSettings, ISystemSettingsModel>(
  'SystemSettings',
  SystemSettingsSchema
);
