import mongoose, { Schema, Document } from 'mongoose';

export interface IArtistProfile extends Document {
  userId: mongoose.Types.ObjectId;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationRequestDate?: Date;
  verificationCompletedDate?: Date;
  verificationRejectionReason?: string;
  
  // Verification documents
  documents: {
    idDocument?: {
      url: string;
      uploadDate: Date;
      verified: boolean;
    };
    proofOfArtistry?: {
      url: string;
      uploadDate: Date;
      verified: boolean;
    };
    additionalDocs?: Array<{
      url: string;
      uploadDate: Date;
      description: string;
    }>;
  };
  
  // Social media links for verification
  socialLinks: {
    spotify?: string;
    appleMusic?: string;
    youtube?: string;
    instagram?: string;
    twitter?: string;
    soundcloud?: string;
    website?: string;
  };
  
  // Artist statistics
  stats: {
    totalStreams: number;
    totalRevenue: number;
    totalSongs: number;
    totalFollowers: number;
    averageRating: number;
    lastPayoutDate?: Date;
  };
  
  // Admin notes
  adminNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const ArtistProfileSchema = new Schema<IArtistProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
    index: true
  },
  
  verificationRequestDate: {
    type: Date,
    default: Date.now
  },
  
  verificationCompletedDate: Date,
  verificationRejectionReason: String,
  
  documents: {
    idDocument: {
      url: String,
      uploadDate: Date,
      verified: { type: Boolean, default: false }
    },
    proofOfArtistry: {
      url: String,
      uploadDate: Date,
      verified: { type: Boolean, default: false }
    },
    additionalDocs: [{
      url: String,
      uploadDate: Date,
      description: String
    }]
  },
  
  socialLinks: {
    spotify: String,
    appleMusic: String,
    youtube: String,
    instagram: String,
    twitter: String,
    soundcloud: String,
    website: String
  },
  
  stats: {
    totalStreams: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalSongs: { type: Number, default: 0 },
    totalFollowers: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    lastPayoutDate: Date
  },
  
  adminNotes: String,
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
ArtistProfileSchema.index({ verificationStatus: 1, verificationRequestDate: -1 });
ArtistProfileSchema.index({ 'stats.totalRevenue': -1 });
ArtistProfileSchema.index({ 'stats.totalStreams': -1 });

export default mongoose.model<IArtistProfile>('ArtistProfile', ArtistProfileSchema);
