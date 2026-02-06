import mongoose, { Document, Schema } from 'mongoose';

export interface ITreasureChest extends Document {
  contentId: mongoose.Types.ObjectId;
  contentType: 'song' | 'bundle';
  rarity: 'common' | 'rare' | 'legendary';
  price: number; // tokens to unlock
  previewImage?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TreasureChestSchema = new Schema<ITreasureChest>(
  {
    contentId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Content ID is required'],
    },
    contentType: {
      type: String,
      enum: ['song', 'bundle'],
      required: [true, 'Content type is required'],
    },
    rarity: {
      type: String,
      enum: ['common', 'rare', 'legendary'],
      default: 'common',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    previewImage: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
TreasureChestSchema.index({ contentId: 1 });
TreasureChestSchema.index({ rarity: 1 });
TreasureChestSchema.index({ createdAt: -1 });

export default mongoose.model<ITreasureChest>('TreasureChest', TreasureChestSchema);
