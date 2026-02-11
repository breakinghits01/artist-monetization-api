import mongoose, { Document, Schema } from 'mongoose';

export interface IPlaylist extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  coverImage?: string;
  isPublic: boolean;
  songs: mongoose.Types.ObjectId[];
  songCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlaylistSchema = new Schema<IPlaylist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Playlist name is required'],
      trim: true,
      maxlength: [100, 'Playlist name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    coverImage: {
      type: String,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    songs: [{
      type: Schema.Types.ObjectId,
      ref: 'Song',
    }],
    songCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PlaylistSchema.index({ userId: 1, createdAt: -1 });
PlaylistSchema.index({ name: 'text', description: 'text' });

// Update songCount before saving
PlaylistSchema.pre('save', function(next) {
  this.songCount = this.songs.length;
  next();
});

export default mongoose.model<IPlaylist>('Playlist', PlaylistSchema);
