import mongoose, { Document, Schema } from 'mongoose';

export interface IFollow extends Document {
  followerId: mongoose.Types.ObjectId;
  followingId: mongoose.Types.ObjectId;
  followedAt: Date;
}

const followSchema = new Schema<IFollow>(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    followingId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    followedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate follows
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Index for efficient queries
followSchema.index({ followingId: 1, followedAt: -1 }); // Get followers of a user
followSchema.index({ followerId: 1, followedAt: -1 }); // Get who a user is following

// Prevent self-following
followSchema.pre('save', function (next) {
  if (this.followerId.equals(this.followingId)) {
    next(new Error('Users cannot follow themselves'));
  } else {
    next();
  }
});

export const Follow = mongoose.model<IFollow>('Follow', followSchema);
