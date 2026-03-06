import mongoose, { Schema, Document } from 'mongoose';

export interface IContentReport extends Document {
  reportType: 'song' | 'user' | 'comment';
  contentId: mongoose.Types.ObjectId;
  reportedBy: mongoose.Types.ObjectId;
  
  reason: 'copyright' | 'inappropriate' | 'spam' | 'harassment' | 'fake_profile' | 'other';
  description: string;
  
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Review details
  reviewedBy?: mongoose.Types.ObjectId;
  reviewDate?: Date;
  reviewNotes?: string;
  action?: 'no_action' | 'warning' | 'content_removed' | 'user_banned' | 'account_suspended';
  
  // Evidence/Screenshots
  evidence?: Array<{
    url: string;
    type: 'image' | 'video' | 'document';
    uploadDate: Date;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

const ContentReportSchema = new Schema<IContentReport>({
  reportType: {
    type: String,
    enum: ['song', 'user', 'comment'],
    required: true,
    index: true
  },
  
  contentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  reportedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  reason: {
    type: String,
    enum: ['copyright', 'inappropriate', 'spam', 'harassment', 'fake_profile', 'other'],
    required: true
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed'],
    default: 'pending',
    index: true
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  reviewDate: Date,
  reviewNotes: String,
  
  action: {
    type: String,
    enum: ['no_action', 'warning', 'content_removed', 'user_banned', 'account_suspended']
  },
  
  evidence: [{
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video', 'document'], required: true },
    uploadDate: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
ContentReportSchema.index({ status: 1, priority: -1, createdAt: -1 });
ContentReportSchema.index({ reportType: 1, status: 1 });
ContentReportSchema.index({ contentId: 1, reportType: 1 });

export default mongoose.model<IContentReport>('ContentReport', ContentReportSchema);
