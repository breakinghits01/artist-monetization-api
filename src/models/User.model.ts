import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type SubscriptionTier = 'free' | 'premium' | 'advanced';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial';

/** Per-user download limits by tier */
export const TIER_DOWNLOAD_LIMITS: Record<SubscriptionTier, number> = {
  free: 0,       // no offline downloads
  premium: 100,  // 100 songs / month
  advanced: -1,  // -1 = unlimited
};

/** Numeric rank so middleware can do >= comparisons */
export const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  premium: 1,
  advanced: 2,
};

export interface ISubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  startDate: Date;
  endDate?: Date | null;
  cancelledAt?: Date | null;
  downloadCount: number;  // resets monthly
  downloadLimit: number;  // mirrors TIER_DOWNLOAD_LIMITS
}

export interface IUser extends Document {
  email: string;
  password: string;
  username?: string;
  role: 'artist' | 'fan' | 'admin';
  subscription: ISubscription;
  tokens: number;
  avatar?: string;
  bio?: string;
  
  // Email verification
  isVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpire?: Date;
  
  // Password reset
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  
  // Security
  lastLogin?: Date;
  lastActiveAt?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  
  // Activity tracking
  sessionId?: string;
  deviceType?: 'mobile' | 'web';
  isOnline: boolean;
  
  // Refresh token
  refreshToken?: string;
  refreshTokenExpire?: Date;
  
  // Moderation (for CMS)
  isBanned: boolean;
  banReason?: string;
  bannedBy?: mongoose.Types.ObjectId;
  bannedAt?: Date;
  moderationStatus: 'active' | 'warning' | 'suspended' | 'banned';
  moderationNotes?: string;
  flagCount: number;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAccountLocked(): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    role: {
      type: String,
      enum: ['artist', 'fan', 'admin'],
      default: 'fan',
    },
    tokens: {
      type: Number,
      default: 0,
      min: [0, 'Tokens cannot be negative'],
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
    lastActiveAt: {
      type: Date,
      index: true,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    
    // Activity tracking
    sessionId: {
      type: String,
      sparse: true,
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'web'],
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    refreshToken: String,
    refreshTokenExpire: Date,
    
    // Moderation fields
    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },
    banReason: String,
    bannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    bannedAt: Date,
    moderationStatus: {
      type: String,
      enum: ['active', 'warning', 'suspended', 'banned'],
      default: 'active',
      index: true,
    },
    moderationNotes: String,
    flagCount: {
      type: Number,
      default: 0,
      index: true,
    },

    // Subscription
    subscription: {
      tier: {
        type: String,
        enum: ['free', 'premium', 'advanced'],
        default: 'free',
        index: true,
      },
      status: {
        type: String,
        enum: ['active', 'cancelled', 'expired', 'trial'],
        default: 'active',
      },
      startDate: { type: Date, default: Date.now },
      endDate: { type: Date, default: null },
      cancelledAt: { type: Date, default: null },
      downloadCount: { type: Number, default: 0 },
      downloadLimit: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
UserSchema.methods.isAccountLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Increment login attempts and lock account if necessary
UserSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < new Date()) {
    await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
    return;
  }

  // Increment attempts
  const updates: any = { $inc: { loginAttempts: 1 } };

  // Lock account after max attempts
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  const lockDuration = parseInt(process.env.LOCK_DURATION || '15') * 60 * 1000;

  if (this.loginAttempts + 1 >= maxAttempts && !this.isAccountLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + lockDuration) };
  }

  await this.updateOne(updates);
};

// Reset login attempts on successful login
UserSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  await this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 },
  });
};

// Remove sensitive data from JSON response
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpire;
  delete obj.refreshToken;
  delete obj.refreshTokenExpire;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};

export default mongoose.model<IUser>('User', UserSchema);
