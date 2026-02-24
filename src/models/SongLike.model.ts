import mongoose, { Document, Schema } from 'mongoose';

export interface ISongLike extends Document {
  userId: mongoose.Types.ObjectId;
  songId: mongoose.Types.ObjectId;
  likeType: 'like' | 'dislike';
  createdAt: Date;
  updatedAt: Date;
}

const SongLikeSchema = new Schema<ISongLike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    songId: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: [true, 'Song ID is required'],
      index: true,
    },
    likeType: {
      type: String,
      enum: ['like', 'dislike'],
      required: [true, 'Like type is required'],
      default: 'like',
    },
  },
  {
    timestamps: true,
    collection: 'songlikes',
  }
);

// Indexes for performance
SongLikeSchema.index({ userId: 1, songId: 1 }, { unique: true }); // One reaction per user per song
SongLikeSchema.index({ songId: 1, likeType: 1 }); // Count likes/dislikes
SongLikeSchema.index({ createdAt: -1 }); // Recent activity
SongLikeSchema.index({ userId: 1, createdAt: -1 }); // User's like history

// Prevent liking own songs (pre-save hook)
SongLikeSchema.pre('save', async function (next) {
  try {
    const Song = mongoose.model('Song');
    const song = await Song.findById(this.songId);
    
    if (song && song.artistId && song.artistId.toString() === this.userId.toString()) {
      throw new Error('Cannot like your own song');
    }
    
    next();
  } catch (error: any) {
    next(error);
  }
});

const SongLike = mongoose.model<ISongLike>('SongLike', SongLikeSchema);

export default SongLike;
