import mongoose, { Schema, Document } from 'mongoose';

export interface IPayout extends Document {
  artistId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  
  // Period covered by this payout
  periodStart: Date;
  periodEnd: Date;
  
  // Revenue breakdown
  breakdown: {
    streams: number;
    downloads: number;
    tips: number;
    subscriptions: number;
    total: number;
  };
  
  // Payment details
  paymentMethod: 'bank_transfer' | 'paypal' | 'stripe' | 'crypto' | 'other';
  paymentDetails?: {
    accountNumber?: string;
    routingNumber?: string;
    paypalEmail?: string;
    walletAddress?: string;
    last4?: string;
  };
  
  // Processing
  processedBy?: mongoose.Types.ObjectId;
  processedDate?: Date;
  transactionId?: string;
  failureReason?: string;
  
  // Admin review
  reviewedBy?: mongoose.Types.ObjectId;
  reviewDate?: Date;
  reviewNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema = new Schema<IPayout>({
  artistId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  periodStart: {
    type: Date,
    required: true
  },
  
  periodEnd: {
    type: Date,
    required: true
  },
  
  breakdown: {
    streams: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    tips: { type: Number, default: 0 },
    subscriptions: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },
  
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'paypal', 'stripe', 'crypto', 'other'],
    required: true
  },
  
  paymentDetails: {
    accountNumber: String,
    routingNumber: String,
    paypalEmail: String,
    walletAddress: String,
    last4: String
  },
  
  processedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  processedDate: Date,
  transactionId: String,
  failureReason: String,
  
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  reviewDate: Date,
  reviewNotes: String
}, {
  timestamps: true
});

// Indexes for efficient queries
PayoutSchema.index({ status: 1, createdAt: -1 });
PayoutSchema.index({ artistId: 1, status: 1, createdAt: -1 });
PayoutSchema.index({ periodStart: 1, periodEnd: 1 });
PayoutSchema.index({ amount: -1 });

export default mongoose.model<IPayout>('Payout', PayoutSchema);
