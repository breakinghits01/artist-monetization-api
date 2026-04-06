import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import User from '../models/User.model';
import Song from '../models/Song.model';
import ArtistProfile from '../models/ArtistProfile.model';
import ContentReport from '../models/ContentReport.model';
import AdminAction from '../models/AdminAction.model';
import Payout from '../models/Payout.model';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/token.utils';

/**
 * Get recent activity (song uploads, user registrations, etc.)
 */
export const getRecentActivity = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get recent songs with artist info
    const recentSongs = await Song.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('artistId', 'username email avatar')
      .select('title artistId createdAt genre');

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username email role createdAt');

    const activities = [
      ...recentSongs.map(song => ({
        type: 'song_upload',
        icon: 'music_note',
        title: `New song uploaded by ${(song.artistId as any)?.username || 'Unknown Artist'}`,
        subtitle: song.title,
        timestamp: song.createdAt,
      })),
      ...recentUsers.filter(u => u.role !== 'admin').map(user => ({
        type: 'user_registered',
        icon: 'person_add',
        title: `New ${user.role} registered`,
        subtitle: user.username || user.email,
        timestamp: user.createdAt,
      })),
    ];

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: activities.slice(0, 10),
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
    });
  }
};

/**
 * Admin login
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user and check if admin
    const user = await User.findOne({ email }).select('+password');

    if (!user || user.role !== 'admin') {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials or insufficient permissions',
      });
      return;
    }

    // Verify password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Generate access token (uses JWT_EXPIRE from env, defaults to 90d)
    const accessToken = generateAccessToken(
      (user._id as any).toString(),
      user.email,
      user.role,
    );

    // Generate refresh token and persist its hash so we can verify it later
    const refreshToken = generateRefreshToken((user._id as any).toString());
    const crypto = await import('crypto');
    const hashedRefresh = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    user.refreshToken = hashedRefresh;
    user.refreshTokenExpire = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    );
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        admin: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

/**
 * Refresh admin access token using a valid refresh token.
 *
 * Flow:
 *   1. Client sends { refreshToken } in request body.
 *   2. We verify the JWT signature and expiry.
 *   3. We look up the user, confirm they are admin, and that the hashed
 *      refresh token matches what we stored at login time.
 *   4. We issue a new access token (and rotate the refresh token so the old
 *      one is immediately invalidated — prevents replay attacks).
 *
 * @route  POST /api/v1/auth/admin/refresh
 * @access Public (only the refresh token is required)
 */
export const adminRefreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };

    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token required.' });
      return;
    }

    // Verify JWT signature + expiry
    let decoded: { userId: string };
    try {
      decoded = verifyRefreshToken(refreshToken) as { userId: string };
    } catch {
      res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
      return;
    }

    // Load user with the stored hashed refresh token
    const user = await User.findById(decoded.userId).select(
      '+refreshToken +refreshTokenExpire +role',
    );

    if (!user || user.role !== 'admin') {
      res.status(401).json({ success: false, message: 'Access denied.' });
      return;
    }

    // Compare the provided token against the stored hash
    const crypto = await import('crypto');
    const hashedProvided = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const isValid =
      user.refreshToken === hashedProvided &&
      user.refreshTokenExpire != null &&
      user.refreshTokenExpire > new Date();

    if (!isValid) {
      // Clear stored token so it can't be retried
      user.refreshToken = undefined;
      user.refreshTokenExpire = undefined;
      await user.save({ validateBeforeSave: false });
      res.status(401).json({ success: false, message: 'Refresh token revoked or expired.' });
      return;
    }

    // Issue new token pair (rotate refresh token for security)
    const newAccessToken = generateAccessToken(
      (user._id as any).toString(),
      user.email,
      user.role,
    );
    const newRefreshToken = generateRefreshToken((user._id as any).toString());

    user.refreshToken = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');
    user.refreshTokenExpire = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error: any) {
    console.error('Admin token refresh error:', error);
    res.status(500).json({ success: false, message: 'Token refresh failed.' });
  }
};

/**
 * Get dashboard overview stats
 */
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      totalArtists,
      totalSongs,
      pendingVerifications,
      pendingReports,
      pendingPayouts,
      totalRevenue,
      bannedUsers,
      flaggedSongs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'artist' }),
      Song.countDocuments(),
      ArtistProfile.countDocuments({ verificationStatus: 'pending' }),
      ContentReport.countDocuments({ status: 'pending' }),
      Payout.countDocuments({ status: 'pending' }),
      Payout.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      User.countDocuments({ isBanned: true }),
      Song.countDocuments({ moderationStatus: 'flagged' }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalArtists,
        totalSongs,
        pendingVerifications,
        pendingReports,
        pendingPayouts,
        revenue: totalRevenue,
        bannedUsers,
        flaggedSongs,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
    });
  }
};

/**
 * Get artists with filters (pending, verified, rejected)
 */
export const getArtists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    const query: any = {};

    if (status === 'pending') {
      query.verificationStatus = 'pending';
    } else if (status === 'verified') {
      query.verificationStatus = 'verified';
    } else if (status === 'rejected') {
      query.verificationStatus = 'rejected';
    }

    const artists = await ArtistProfile.find(query)
      .populate('userId', 'username email avatar')
      .populate('reviewedBy', 'username')
      .sort({ verificationRequestDate: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await ArtistProfile.countDocuments(query);

    res.json({
      success: true,
      data: {
        artists,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get artists error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch artists',
    });
  }
};

/**
 * Approve artist verification
 */
export const approveArtist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { artistId } = req.params;
    const adminId = (req as any).user?.userId;

    const profile = await ArtistProfile.findByIdAndUpdate(
      artistId,
      {
        verificationStatus: 'verified',
        verificationCompletedDate: new Date(),
        reviewedBy: adminId,
      },
      { new: true }
    ).populate('userId', 'username email');

    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'Artist profile not found',
      });
      return;
    }

    // Log admin action
    await AdminAction.create({
      adminId,
      action: 'artist_verified',
      targetType: 'artist_profile',
      targetId: profile._id,
      reason: 'Artist verification approved',
      details: {
        previousStatus: 'pending',
        newStatus: 'verified',
      },
    });

    res.json({
      success: true,
      data: { artist: profile },
      message: 'Artist approved successfully',
    });
  } catch (error) {
    console.error('Approve artist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve artist',
    });
  }
};

/**
 * Reject artist verification
 */
export const rejectArtist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { artistId } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;

    const profile = await ArtistProfile.findByIdAndUpdate(
      artistId,
      {
        verificationStatus: 'rejected',
        verificationRejectionReason: reason,
        verificationCompletedDate: new Date(),
        reviewedBy: adminId,
      },
      { new: true }
    ).populate('userId', 'username email');

    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'Artist profile not found',
      });
      return;
    }

    // Log admin action
    await AdminAction.create({
      adminId,
      action: 'artist_rejected',
      targetType: 'artist_profile',
      targetId: profile._id,
      reason,
      details: {
        previousStatus: 'pending',
        newStatus: 'rejected',
      },
    });

    res.json({
      success: true,
      data: { artist: profile },
      message: 'Artist rejected',
    });
  } catch (error) {
    console.error('Reject artist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject artist',
    });
  }
};

/**
 * Get songs with moderation filters
 */
export const getSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status = 'flagged', page = 1, limit = 20 } = req.query;

    const query: any = {};

    if (status === 'flagged') {
      query.moderationStatus = 'flagged';
    } else if (status === 'removed') {
      query.moderationStatus = 'removed';
    } else if (status === 'pending') {
      query.moderationStatus = 'pending';
    } else if (status === 'approved') {
      query.moderationStatus = 'approved';
    }

    const songs = await Song.find(query)
      .populate('artistId', 'username avatar email')
      .populate('reviewedBy', 'username')
      .sort({ flagCount: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Song.countDocuments(query);

    res.json({
      success: true,
      data: {
        songs,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get songs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch songs',
    });
  }
};

/**
 * Remove song
 */
export const removeSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;

    const song = await Song.findByIdAndUpdate(
      songId,
      {
        moderationStatus: 'removed',
        moderationNotes: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      { new: true }
    );

    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found',
      });
      return;
    }

    // Log admin action
    await AdminAction.create({
      adminId,
      action: 'song_removed',
      targetType: 'song',
      targetId: song._id,
      reason,
      details: {
        previousStatus: song.moderationStatus,
        newStatus: 'removed',
      },
    });

    res.json({
      success: true,
      message: 'Song removed successfully',
    });
  } catch (error) {
    console.error('Remove song error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove song',
    });
  }
};

/**
 * Get users with filters
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status = 'all', role, page = 1, limit = 20 } = req.query;

    const query: any = {};

    // Status filter
    if (status === 'online') {
      query.isOnline = true;
    } else if (status === 'active') {
      query.moderationStatus = 'active';
    } else if (status === 'warning') {
      query.moderationStatus = 'warning';
    } else if (status === 'suspended') {
      query.moderationStatus = 'suspended';
    } else if (status === 'banned') {
      query.isBanned = true;
    }
    
    // Role filter
    if (role && role !== 'all') {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
};

/**
 * Update user status (ban/suspend/warn/activate)
 */
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { action, reason } = req.body; // action: 'ban', 'suspend', 'warn', 'activate'
    const adminId = (req as any).user?.userId;

    const updates: any = { moderationNotes: reason };

    if (action === 'ban') {
      updates.isBanned = true;
      updates.moderationStatus = 'banned';
      updates.bannedBy = adminId;
      updates.bannedAt = new Date();
      updates.banReason = reason;
    } else if (action === 'suspend') {
      updates.moderationStatus = 'suspended';
    } else if (action === 'warn') {
      updates.moderationStatus = 'warning';
    } else if (action === 'activate') {
      updates.isBanned = false;
      updates.moderationStatus = 'active';
      updates.bannedBy = undefined;
      updates.bannedAt = undefined;
      updates.banReason = undefined;
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Log admin action
    await AdminAction.create({
      adminId,
      action: action === 'ban' ? 'user_banned' : action === 'activate' ? 'user_unbanned' : 'other',
      targetType: 'user',
      targetId: user._id,
      reason,
      details: {
        newStatus: updates.moderationStatus,
      },
    });

    res.json({
      success: true,
      data: { user },
      message: `User ${action}ed successfully`,
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
    });
  }
};

/**
 * Get revenue stats with real data from Payout model
 */
export const getRevenueStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalRevenue, pendingPayoutsData, completedPayoutsData, pendingCount] = await Promise.all([
      Payout.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      Payout.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      Payout.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      Payout.countDocuments({ status: 'pending' }),
    ]);

    res.json({
      success: true,
      data: {
        totalRevenue,
        pendingPayouts: pendingPayoutsData,
        completedPayouts: completedPayoutsData,
        pendingPayoutCount: pendingCount,
      },
    });
  } catch (error) {
    console.error('Get revenue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue stats',
    });
  }
};

/**
 * Get single user details
 */
export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password -refreshToken');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Get user stats
    const [songCount, followerCount, totalRevenue] = await Promise.all([
      Song.countDocuments({ artistId: userId }),
      mongoose.model('Follow').countDocuments({ following: userId }),
      Payout.aggregate([
        { $match: { artistId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
    ]);

    res.json({
      success: true,
      data: {
        user,
        stats: {
          songCount,
          followerCount,
          totalRevenue,
        },
      },
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
    });
  }
};

/**
 * Change user role (admin, artist, fan)
 */
export const changeUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role, reason } = req.body;
    const adminId = (req as any).user?._id || (req as any).user?.userId || (req as any).userId;

    // Validate role
    if (!['admin', 'artist', 'fan'].includes(role)) {
      res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, artist, or fan',
      });
      return;
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Store previous role
    const previousRole = user.role;

    // Don't allow changing own role
    if (userId === adminId) {
      res.status(403).json({
        success: false,
        message: 'Cannot change your own role',
      });
      return;
    }

    // Update role
    user.role = role;
    await user.save();

    // If changing to artist, create artist profile if not exists
    if (role === 'artist') {
      const existingProfile = await ArtistProfile.findOne({ userId });
      if (!existingProfile) {
        await ArtistProfile.create({
          userId,
          bio: '',
          genres: [],
          socialLinks: {},
          status: 'active',
          isVerified: false,
          verificationStatus: 'pending',
        });
      }
    }

    // Log admin action
    await AdminAction.create({
      adminId,
      action: 'role_changed',
      targetType: 'user',
      targetId: user._id,
      reason: reason || `Role changed from ${previousRole} to ${role}`,
      details: {
        previousRole,
        newRole: role,
      },
    });

    res.json({
      success: true,
      data: { user },
      message: `User role changed to ${role} successfully`,
    });
  } catch (error) {
    console.error('Change user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change user role',
    });
  }
};

/**
 * Reset user password (Admin only)
 */
export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { newPassword, reason } = req.body;
    const adminId = (req as any).user?._id || (req as any).user?.userId || (req as any).userId;

    // Validation
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Don't allow resetting admin passwords (extra security)
    if (user.role === 'admin') {
      res.status(403).json({
        success: false,
        message: 'Cannot reset admin user passwords',
      });
      return;
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    // Log admin action for audit trail
    await AdminAction.create({
      adminId,
      action: 'password_reset',
      targetType: 'user',
      targetId: user._id,
      reason: reason || 'Password reset by administrator',
      details: {
        username: user.username,
        email: user.email,
        timestamp: new Date(),
      },
    });

    res.json({
      success: true,
      message: `Password reset successfully for user ${user.username || user.email}`,
    });
  } catch (error: any) {
    console.error('Reset user password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset user password',
    });
  }
};

// ─── Conversion temp-file helpers ─────────────────────────────────────────────

const TEMP_DIR = path.join(process.cwd(), 'temp');

/** Patterns written by AudioConverterService — anything else is left untouched. */
const TEMP_FILE_PREFIXES = ['input-', 'output-', 'meta-'];

function isTempAudioFile(name: string): boolean {
  return TEMP_FILE_PREFIXES.some((p) => name.startsWith(p));
}

/**
 * GET /admin/temp-files
 * List orphaned mid-conversion temp files with size and age info.
 */
export const getTempFiles = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!fs.existsSync(TEMP_DIR)) {
      res.json({
        success: true,
        data: { files: [], totalSize: 0, totalSizeFormatted: '0 B', tempDir: TEMP_DIR },
      });
      return;
    }

    const entries = fs.readdirSync(TEMP_DIR);
    const now = Date.now();

    const files = entries
      .filter(isTempAudioFile)
      .map((name) => {
        const filePath = path.join(TEMP_DIR, name);
        const stat = fs.statSync(filePath);
        const ageMs = now - stat.mtimeMs;
        const ageMins = Math.floor(ageMs / 60_000);

        return {
          name,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size),
          ageMs,
          ageFormatted: ageMins < 60
            ? `${ageMins}m ago`
            : `${Math.floor(ageMins / 60)}h ${ageMins % 60}m ago`,
          modifiedAt: stat.mtime.toISOString(),
          /** Files older than 10 minutes are almost certainly orphaned */
          isOrphaned: ageMs > 10 * 60_000,
        };
      })
      .sort((a, b) => b.ageMs - a.ageMs); // oldest first

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);

    res.json({
      success: true,
      data: {
        files,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        tempDir: TEMP_DIR,
      },
    });
  } catch (error: any) {
    console.error('getTempFiles error:', error);
    res.status(500).json({ success: false, message: 'Failed to list temp files', error: error.message });
  }
};

/**
 * DELETE /admin/temp-files
 * Delete all (or only orphaned) AudioConverterService temp files.
 * Query param: ?orphanedOnly=true  → only delete files older than 10 minutes
 */
export const cleanupTempFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const orphanedOnly = req.query.orphanedOnly === 'true';

    if (!fs.existsSync(TEMP_DIR)) {
      res.json({ success: true, data: { deleted: 0, freedBytes: 0, freedFormatted: '0 B' } });
      return;
    }

    const entries = fs.readdirSync(TEMP_DIR).filter(isTempAudioFile);
    const now = Date.now();

    let deleted = 0;
    let freedBytes = 0;
    const errors: string[] = [];

    for (const name of entries) {
      const filePath = path.join(TEMP_DIR, name);
      try {
        const stat = fs.statSync(filePath);
        const isOld = (now - stat.mtimeMs) > 10 * 60_000;

        if (orphanedOnly && !isOld) continue;

        freedBytes += stat.size;
        fs.unlinkSync(filePath);
        deleted++;
        console.log(`🧹 [admin] Deleted temp file: ${name}`);
      } catch (e: any) {
        errors.push(`${name}: ${e.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        deleted,
        freedBytes,
        freedFormatted: formatBytes(freedBytes),
        errors: errors.length ? errors : undefined,
      },
      message: `Deleted ${deleted} file${deleted !== 1 ? 's' : ''}, freed ${formatBytes(freedBytes)}`,
    });
  } catch (error: any) {
    console.error('cleanupTempFiles error:', error);
    res.status(500).json({ success: false, message: 'Failed to cleanup temp files', error: error.message });
  }
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
