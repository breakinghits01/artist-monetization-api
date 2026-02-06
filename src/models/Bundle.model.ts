import mongoose, { Document, Schema } from 'mongoose';

export interface IBundle extends Document {
  artistId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  songIds: mongoose.Types.ObjectId[];
  originalPrice: number; // Sum of individual song prices
  bundlePrice: number; // Discounted price
  discountPercentage: number;
  coverArt?: string;
  purchaseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BundleSchema = new Schema<IBundle>(
  {
    artistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Artist ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Bundle title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    songIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Song',
      },
    ],
    originalPrice: {
      type: Number,
      required: [true, 'Original price is required'],
      min: [0, 'Price cannot be negative'],
    },
    bundlePrice: {
      type: Number,
      required: [true, 'Bundle price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
    coverArt: {
      type: String,
      default: null,
    },
    purchaseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
BundleSchema.index({ artistId: 1 });
BundleSchema.index({ createdAt: -1 });

// Validate that bundle contains at least 2 songs
BundleSchema.pre('save', function (next) {
  if (this.songIds.length < 2) {
    throw new Error('Bundle must contain at least 2 songs');
  }
  next();
});

export default mongoose.model<IBundle>('Bundle', BundleSchema);
