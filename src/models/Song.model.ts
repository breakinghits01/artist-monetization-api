import mongoose, { Document, Schema } from 'mongoose';

export interface ISong extends Document {
  artistId: mongoose.Types.ObjectId;
  title: string;
  duration: number; // in seconds
  price: number; // in tokens
  coverArt?: string;
  audioUrl: string;
  exclusive: boolean;
  genre?: string;
  description?: string;
  playCount: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SongSchema = new Schema<ISong>(
  {
    artistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Artist ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Song title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 second'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      default: 10,
    },
    coverArt: {
      type: String,
      default: null,
    },
    audioUrl: {
      type: String,
      required: [true, 'Audio URL is required'],
    },
    exclusive: {
      type: Boolean,
      default: false,
    },
    genre: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SongSchema.index({ artistId: 1 });
SongSchema.index({ title: 'text', description: 'text' });
SongSchema.index({ genre: 1 });
SongSchema.index({ createdAt: -1 });
SongSchema.index({ playCount: -1 });

// Validate max songs per artist (10 songs limit)
SongSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Song').countDocuments({ 
      artistId: this.artistId 
    });
    
    if (count >= parseInt(process.env.MAX_SONGS_PER_ARTIST || '10')) {
      throw new Error('Artist has reached the maximum limit of 10 songs');
    }
  }
  next();
});

export default mongoose.model<ISong>('Song', SongSchema);
