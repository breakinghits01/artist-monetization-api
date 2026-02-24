import mongoose, { Document, Schema } from 'mongoose';

export interface ISongShare extends Document {
  userId: mongoose.Types.ObjectId;
  songId: mongoose.Types.ObjectId;
  shareType: 'link' | 'social' | 'download' | 'playlist';
  platform?: string; // e.g., 'whatsapp', 'twitter', 'facebook'
  createdAt: Date;
}

const SongShareSchema = new Schema<ISongShare>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    songId: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: [true, 'Song ID is required'],
      index: true,
    },
    shareType: {
      type: String,
      enum: ['link', 'social', 'download', 'playlist'],
      required: [true, 'Share type is required'],
      default: 'link',
    },
    platform: {
      type: String,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only track creation
    collection: 'songshares',
  }
);

// Indexes for performance
SongShareSchema.index({ songId: 1, shareType: 1 }); // Count shares by type
SongShareSchema.index({ userId: 1, createdAt: -1 }); // User share history
SongShareSchema.index({ createdAt: -1 }); // Recent shares
SongShareSchema.index({ songId: 1, createdAt: -1 }); // Song share timeline

const SongShare = mongoose.model<ISongShare>('SongShare', SongShareSchema);

export default SongShare;
