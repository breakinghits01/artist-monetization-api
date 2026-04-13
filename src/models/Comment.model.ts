import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  userId: mongoose.Types.ObjectId;
  songId: mongoose.Types.ObjectId;
  content: string;
  parentCommentId?: mongoose.Types.ObjectId;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const CommentSchema = new Schema<IComment>(
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
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    likes: {
      type: Number,
      default: 0,
      min: 0,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'comments',
  }
);

// Indexes for performance
CommentSchema.index({ songId: 1, createdAt: -1 }); // Recent comments per song
CommentSchema.index({ userId: 1, createdAt: -1 }); // User's comments
CommentSchema.index({ parentCommentId: 1 }); // Thread replies
CommentSchema.index({ songId: 1, deletedAt: 1 }); // Active comments per song

// Update Song commentCount when comment is created
CommentSchema.post('save', async function() {
  const Song = (await import('./Song.model')).default;
  await Song.findByIdAndUpdate(this.songId, { $inc: { commentCount: 1 } });
});

// Update Song commentCount when comment is deleted (soft delete via deletedAt)
CommentSchema.post('findOneAndUpdate', async function(doc) {
  if (doc && doc.deletedAt) {
    const Song = (await import('./Song.model')).default;
    await Song.findByIdAndUpdate(doc.songId, { $inc: { commentCount: -1 } });
  }
});

// Virtual for reply count
CommentSchema.virtual('replyCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentCommentId',
  count: true,
});

// Ensure virtuals are included in JSON
CommentSchema.set('toJSON', { virtuals: true });
CommentSchema.set('toObject', { virtuals: true });

const Comment = mongoose.model<IComment>('Comment', CommentSchema);

export default Comment;
