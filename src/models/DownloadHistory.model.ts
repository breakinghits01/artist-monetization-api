import mongoose, { Schema, Document } from 'mongoose';

export interface IDownloadHistory extends Document {
  userId: mongoose.Types.ObjectId;
  songId: mongoose.Types.ObjectId;
  format: 'mp3' | 'wav' | 'flac' | 'ogg' | 'm4a' | 'aac';
  fileSize: number;
  downloadedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

const DownloadHistorySchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    songId: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'],
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for rate limiting queries
DownloadHistorySchema.index({ userId: 1, downloadedAt: -1 });
DownloadHistorySchema.index({ songId: 1, downloadedAt: -1 });

export default mongoose.model<IDownloadHistory>('DownloadHistory', DownloadHistorySchema);
