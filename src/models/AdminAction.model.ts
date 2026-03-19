import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminAction extends Document {
  adminId: mongoose.Types.ObjectId;
  action: 'user_banned' | 'user_unbanned' | 'song_removed' | 'song_approved' | 
          'artist_verified' | 'artist_rejected' | 'report_resolved' | 
          'payout_approved' | 'payout_rejected' | 'content_flagged' | 
          'role_changed' | 'password_reset' | 'other';
  
  targetType: 'user' | 'song' | 'artist_profile' | 'report' | 'payout' | 'system';
  targetId?: mongoose.Types.ObjectId;
  
  reason: string;
  details?: {
    previousStatus?: string;
    newStatus?: string;
    amount?: number;
    duration?: string;
    additionalInfo?: any;
  };
  
  ipAddress?: string;
  userAgent?: string;
  
  createdAt: Date;
}

const AdminActionSchema = new Schema<IAdminAction>({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  action: {
    type: String,
    enum: [
      'user_banned', 
      'user_unbanned', 
      'song_removed', 
      'song_approved',
      'artist_verified', 
      'artist_rejected', 
      'report_resolved',
      'payout_approved', 
      'payout_rejected', 
      'content_flagged',
      'role_changed',
      'password_reset',
      'other'
    ],
    required: true,
    index: true
  },
  
  targetType: {
    type: String,
    enum: ['user', 'song', 'artist_profile', 'report', 'payout', 'system'],
    required: true,
    index: true
  },
  
  targetId: {
    type: Schema.Types.ObjectId,
    index: true
  },
  
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  details: {
    previousStatus: String,
    newStatus: String,
    amount: Number,
    duration: String,
    additionalInfo: Schema.Types.Mixed
  },
  
  ipAddress: String,
  userAgent: String
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Indexes for audit trail queries
AdminActionSchema.index({ createdAt: -1 });
AdminActionSchema.index({ adminId: 1, createdAt: -1 });
AdminActionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
AdminActionSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model<IAdminAction>('AdminAction', AdminActionSchema);
