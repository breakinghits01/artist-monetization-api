/**
 * Share Controller
 * Handles song sharing events
 */

import { Request, Response, NextFunction } from 'express';
import SongShare from '../models/SongShare.model';
import Song from '../models/Song.model';
import { incrementShareCount } from '../utils/engagement.utils';
import mongoose from 'mongoose';

/**
 * Track a share event
 * POST /api/v1/songs/:songId/share
 * Body: { shareType: 'link' | 'social' | 'download' | 'playlist', platform?: string }
 */
export const trackShare = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;
    const { shareType, platform } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    // Validate shareType
    const validShareTypes = ['link', 'social', 'download', 'playlist'];
    if (!shareType || !validShareTypes.includes(shareType)) {
      res.status(400).json({
        message: 'Invalid share type. Must be one of: link, social, download, playlist',
      });
    }

    // Check if song exists
    const song = await Song.findById(songId);
    if (!song) {
      res.status(404).json({ message: 'Song not found' });
    }

    // Create share record
    const share = await SongShare.create({
      userId,
      songId,
      shareType,
      platform: platform?.toLowerCase(),
    });

    // Increment share count
    await incrementShareCount(songId);

    res.status(201).json({
      message: 'Share tracked',
      share: {
        id: share._id,
        shareType: share.shareType,
        platform: share.platform,
        createdAt: share.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get share statistics for a song
 * GET /api/v1/songs/:songId/shares/stats
 */
export const getShareStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    // Aggregate shares by type
    const sharesByType = await SongShare.aggregate([
      { $match: { songId: new mongoose.Types.ObjectId(songId) } },
      {
        $group: {
          _id: '$shareType',
          count: { $sum: 1 },
        },
      },
    ]);

    // Aggregate shares by platform (for social shares)
    const sharesByPlatform = await SongShare.aggregate([
      {
        $match: {
          songId: new mongoose.Types.ObjectId(songId),
          shareType: 'social',
          platform: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get total count
    const totalShares = await SongShare.countDocuments({ songId });

    // Format results
    const byType = sharesByType.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const byPlatform = sharesByPlatform.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total: totalShares,
      byType: {
        link: byType.link || 0,
        social: byType.social || 0,
        download: byType.download || 0,
        playlist: byType.playlist || 0,
      },
      byPlatform,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's share history
 * GET /api/v1/users/me/shares?page=1&limit=20
 */
export const getUserShares = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    const [shares, total] = await Promise.all([
      SongShare.find({ userId })
        .populate('songId', 'title coverArt artistId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SongShare.countDocuments({ userId }),
    ]);

    res.json({
      shares,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};
