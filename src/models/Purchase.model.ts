import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchase extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;
  itemType: 'song' | 'bundle';
  amount: number; // tokens paid
  platform: 'web' | 'app';
  discountApplied: number; // percentage
  originalPrice: number;
  finalPrice: number;
  createdAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Item ID is required'],
    },
    itemType: {
      type: String,
      enum: ['song', 'bundle'],
      required: [true, 'Item type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    platform: {
      type: String,
      enum: ['web', 'app'],
      required: [true, 'Platform is required'],
    },
    discountApplied: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
    originalPrice: {
      type: Number,
      required: [true, 'Original price is required'],
    },
    finalPrice: {
      type: Number,
      required: [true, 'Final price is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PurchaseSchema.index({ userId: 1 });
PurchaseSchema.index({ itemId: 1 });
PurchaseSchema.index({ createdAt: -1 });
PurchaseSchema.index({ platform: 1 });

export default mongoose.model<IPurchase>('Purchase', PurchaseSchema);
