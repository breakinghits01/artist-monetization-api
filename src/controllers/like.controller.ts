/**
 * Song Like Controller
 * Handles like/dislike reactions for songs
 */

import { Request, Response, NextFunction } from 'express';
import SongLike from '../models/SongLike.model';
import Song from '../models/Song.model';
import { updateLikeCounts } from '../utils/engagement.utils';
import mongoose from 'mongoose';

/**
 * Toggle like on a song
 * POST /api/v1/songs/:songId/like
 */
export const toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    // Validate songId
    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    // Check if song exists
    const song = await Song.findById(songId);
    if (!song) {
      res.status(404).json({ message: 'Song not found' });
    }

    // Check if user already has a reaction
    const existingReaction = await SongLike.findOne({ userId, songId });

    if (existingReaction) {
      if (existingReaction.likeType === 'like') {
        // Already liked - remove like
        await SongLike.deleteOne({ _id: existingReaction._id });
        await updateLikeCounts(songId);
        
        res.json({
          message: 'Like removed',
          reaction: null,
        });
      } else {
        // Was dislike - change to like
        existingReaction.likeType = 'like';
        await existingReaction.save();
        await updateLikeCounts(songId);
        
        res.json({
          message: 'Changed to like',
          reaction: 'like',
        });
      }
    } else {
      // No existing reaction - create like
      await SongLike.create({ userId, songId, likeType: 'like' });
      await updateLikeCounts(songId);
      
      res.status(201).json({
        message: 'Song liked',
        reaction: 'like',
      });
    }
  } catch (error: any) {
    if (error.message?.includes('Cannot like your own song')) {
      res.status(403).json({ message: 'Cannot like your own song' });
    }
    next(error);
  }
};

/**
 * Toggle dislike on a song
 * POST /api/v1/songs/:songId/dislike
 */
export const toggleDislike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    const song = await Song.findById(songId);
    if (!song) {
      res.status(404).json({ message: 'Song not found' });
    }

    const existingReaction = await SongLike.findOne({ userId, songId });

    if (existingReaction) {
      if (existingReaction.likeType === 'dislike') {
        // Already disliked - remove dislike
        await SongLike.deleteOne({ _id: existingReaction._id });
        await updateLikeCounts(songId);
        
        res.json({
          message: 'Dislike removed',
          reaction: null,
        });
      } else {
        // Was like - change to dislike
        existingReaction.likeType = 'dislike';
        await existingReaction.save();
        await updateLikeCounts(songId);
        
        res.json({
          message: 'Changed to dislike',
          reaction: 'dislike',
        });
      }
    } else {
      // No existing reaction - create dislike
      await SongLike.create({ userId, songId, likeType: 'dislike' });
      await updateLikeCounts(songId);
      
      res.status(201).json({
        message: 'Song disliked',
        reaction: 'dislike',
      });
    }
  } catch (error: any) {
    if (error.message?.includes('Cannot like your own song')) {
      res.status(403).json({ message: 'Cannot dislike your own song' });
    }
    next(error);
  }
};

/**
 * Remove reaction from a song
 * DELETE /api/v1/songs/:songId/reaction
 */
export const removeReaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    const result = await SongLike.deleteOne({ userId, songId });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'No reaction found' });
    }

    await updateLikeCounts(songId);

    res.json({ message: 'Reaction removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's reaction for a song
 * GET /api/v1/songs/:songId/reaction
 */
export const getUserReaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    const reaction = await SongLike.findOne({ userId, songId });

    res.json({
      reaction: reaction ? reaction.likeType : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get engagement stats for a song
 * GET /api/v1/songs/:songId/stats
 */
export const getSongStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    const song = await Song.findById(songId).select(
      'likeCount dislikeCount commentCount shareCount averageRating ratingCount engagementScore playCount'
    );

    if (!song) {
      res.status(404).json({ message: 'Song not found' });
      return;
    }

    // Get user's engagement status if authenticated
    let userEngagement = null;
    if (req.user?.id) {
      const [reaction, hasRated, hasCommented] = await Promise.all([
        SongLike.findOne({ userId: req.user.id, songId }),
        mongoose.model('Rating').findOne({ userId: req.user.id, songId }),
        mongoose.model('Comment').findOne({ userId: req.user.id, songId, deletedAt: null }),
      ]);

      userEngagement = {
        hasLiked: reaction?.likeType === 'like',
        hasDisliked: reaction?.likeType === 'dislike',
        hasRated: !!hasRated,
        userRating: hasRated?.stars || null,
        hasCommented: !!hasCommented,
      };
    }

    res.json({
      stats: {
        likeCount: song.likeCount ?? 0,
        dislikeCount: song.dislikeCount ?? 0,
        commentCount: song.commentCount ?? 0,
        shareCount: song.shareCount ?? 0,
        averageRating: song.averageRating ?? 0,
        ratingCount: song.ratingCount ?? 0,
        engagementScore: song.engagementScore ?? 0,
        playCount: song.playCount ?? 0,
      },
      userEngagement,
    });
  } catch (error) {
    next(error);
  }
};
