import mongoose, { Document, Schema } from 'mongoose';

export interface IFollow extends Document {
  followerId: mongoose.Types.ObjectId;
  followingId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Follower ID is required'],
    },
    followingId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Following ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique follow relationships
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
FollowSchema.index({ followerId: 1 });
FollowSchema.index({ followingId: 1 });

// Prevent users from following themselves
FollowSchema.pre('save', function (next) {
  if (this.followerId.toString() === this.followingId.toString()) {
    throw new Error('Users cannot follow themselves');
  }
  next();
});

export default mongoose.model<IFollow>('Follow', FollowSchema);
