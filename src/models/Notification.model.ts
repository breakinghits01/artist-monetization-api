import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'follow' | 'like' | 'favorite' | 'tip' | 'comment';
  senderId: mongoose.Types.ObjectId;
  songId?: mongoose.Types.ObjectId;
  message: string;
  metadata?: {
    amount?: number;
    commentText?: string;
  };
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['follow', 'like', 'favorite', 'tip', 'comment'],
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    songId: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      amount: Number,
      commentText: String,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
