import mongoose, { Document, Schema } from 'mongoose';

export interface IPlaySession extends Document {
  userId: mongoose.Types.ObjectId;
  songId: mongoose.Types.ObjectId;
  startedAt: Date;
  incrementedAt?: Date;
  progress: number; // 0.0 to 1.0 (percentage listened)
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlaySessionSchema = new Schema<IPlaySession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    songId: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    incrementedAt: {
      type: Date,
      default: null,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
PlaySessionSchema.index({ userId: 1, songId: 1, startedAt: -1 });

// Auto-expire old sessions after 24 hours (uses createdAt from timestamps)
PlaySessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IPlaySession>('PlaySession', PlaySessionSchema);
