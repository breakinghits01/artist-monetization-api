import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'purchase_tokens' | 'purchase_song' | 'purchase_bundle' | 'tip_sent' | 'tip_received' | 'earnings';
  amount: number; // positive or negative
  balanceAfter: number;
  relatedId?: mongoose.Types.ObjectId; // Reference to related document
  description: string;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    type: {
      type: String,
      enum: ['purchase_tokens', 'purchase_song', 'purchase_bundle', 'tip_sent', 'tip_received', 'earnings'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after transaction is required'],
      min: [0, 'Balance cannot be negative'],
    },
    relatedId: {
      type: Schema.Types.ObjectId,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
TransactionSchema.index({ userId: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ type: 1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
