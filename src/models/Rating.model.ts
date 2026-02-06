import mongoose, { Document, Schema } from 'mongoose';

export interface IRating extends Document {
  userId: mongoose.Types.ObjectId;
  songId: mongoose.Types.ObjectId;
  stars: number; // 1-5
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RatingSchema = new Schema<IRating>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    songId: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: [true, 'Song ID is required'],
    },
    stars: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one rating per user per song
RatingSchema.index({ userId: 1, songId: 1 }, { unique: true });
RatingSchema.index({ songId: 1 });
RatingSchema.index({ createdAt: -1 });

// Prevent artists from rating their own songs
RatingSchema.pre('save', async function (next) {
  const Song = mongoose.model('Song');
  const song = await Song.findById(this.songId);
  
  if (!song) {
    throw new Error('Song not found');
  }
  
  if (song.artistId.toString() === this.userId.toString()) {
    throw new Error('Artists cannot rate their own songs');
  }
  
  next();
});

export default mongoose.model<IRating>('Rating', RatingSchema);
