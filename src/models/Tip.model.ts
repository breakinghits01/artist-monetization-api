import mongoose, { Document, Schema } from 'mongoose';

export interface ITip extends Document {
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  amount: number; // tokens
  message?: string;
  createdAt: Date;
}

const TipSchema = new Schema<ITip>(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Tip amount must be at least 1 token'],
    },
    message: {
      type: String,
      maxlength: [200, 'Message cannot exceed 200 characters'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
TipSchema.index({ fromUserId: 1 });
TipSchema.index({ toUserId: 1 });
TipSchema.index({ createdAt: -1 });

// Prevent users from tipping themselves
TipSchema.pre('save', function (next) {
  if (this.fromUserId.toString() === this.toUserId.toString()) {
    throw new Error('Users cannot tip themselves');
  }
  next();
});

export default mongoose.model<ITip>('Tip', TipSchema);
