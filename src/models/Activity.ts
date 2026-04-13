import mongoose, { Document, Schema } from 'mongoose';

export enum ActivityType {
  FOLLOW = 'follow',
  SONG_UPLOAD = 'song_upload',
  EXCLUSIVE_RELEASE = 'exclusive_release',
  BUNDLE_CREATED = 'bundle_created',
}

export interface IActivity extends Document {
  userId: mongoose.Types.ObjectId;
  type: ActivityType;
  targetId: mongoose.Types.ObjectId;
  targetModel: 'User' | 'Song' | 'Bundle';
  message: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'targetModel',
    },
    targetModel: {
      type: String,
      required: true,
      enum: ['User', 'Song', 'Bundle'],
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for efficient feed queries
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

// TTL index - auto-delete activities older than 90 days
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Activity = mongoose.model<IActivity>('Activity', activitySchema);
