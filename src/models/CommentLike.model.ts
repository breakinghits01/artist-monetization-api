import mongoose, { Document, Schema } from 'mongoose';

export interface ICommentLike extends Document {
  userId: mongoose.Types.ObjectId;
  commentId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CommentLikeSchema = new Schema<ICommentLike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      required: [true, 'Comment ID is required'],
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'commentlikes',
  }
);

// Indexes
CommentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true }); // One like per user per comment
CommentLikeSchema.index({ commentId: 1 }); // Count likes per comment
CommentLikeSchema.index({ createdAt: -1 }); // Recent activity

const CommentLike = mongoose.model<ICommentLike>('CommentLike', CommentLikeSchema);

export default CommentLike;
