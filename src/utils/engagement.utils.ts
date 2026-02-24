/**
 * Engagement Utilities
 * Helper functions for calculating and updating engagement metrics
 */

import Song from '../models/Song.model';
import SongLike from '../models/SongLike.model';
import Comment from '../models/Comment.model';
import SongShare from '../models/SongShare.model';
import Rating from '../models/Rating.model';
import mongoose from 'mongoose';

/**
 * Calculate engagement score for a song
 * Formula: (likes × 5) + (comments × 10) + (shares × 15) + (plays × 1) + (avgRating × 20) - (dislikes × 2)
 */
export function calculateEngagementScore(metrics: {
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  shareCount: number;
  playCount: number;
  averageRating: number;
}): number {
  const score =
    metrics.likeCount * 5 +
    metrics.commentCount * 10 +
    metrics.shareCount * 15 +
    metrics.playCount * 1 +
    metrics.averageRating * 20 -
    metrics.dislikeCount * 2;

  return Math.max(0, score); // Ensure non-negative
}

/**
 * Update engagement metrics for a song
 * Aggregates data from SongLike, Comment, SongShare, and Rating collections
 */
export async function updateSongEngagementMetrics(songId: string | mongoose.Types.ObjectId) {
  const objectId = typeof songId === 'string' ? new mongoose.Types.ObjectId(songId) : songId;

  // Aggregate likes/dislikes
  const likeStats = await SongLike.aggregate([
    { $match: { songId: objectId } },
    {
      $group: {
        _id: '$likeType',
        count: { $sum: 1 },
      },
    },
  ]);

  const likeCount = likeStats.find((s) => s._id === 'like')?.count || 0;
  const dislikeCount = likeStats.find((s) => s._id === 'dislike')?.count || 0;

  // Count comments (exclude deleted)
  const commentCount = await Comment.countDocuments({
    songId: objectId,
    deletedAt: null,
  });

  // Count shares
  const shareCount = await SongShare.countDocuments({ songId: objectId });

  // Calculate average rating
  const ratingStats = await Rating.aggregate([
    { $match: { songId: objectId } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$stars' },
        count: { $sum: 1 },
      },
    },
  ]);

  const averageRating = ratingStats[0]?.avgRating || 0;
  const ratingCount = ratingStats[0]?.count || 0;

  // Get current play count
  const song = await Song.findById(objectId).select('playCount');
  const playCount = song?.playCount || 0;

  // Calculate engagement score
  const engagementScore = calculateEngagementScore({
    likeCount,
    dislikeCount,
    commentCount,
    shareCount,
    playCount,
    averageRating,
  });

  // Update song with new metrics
  await Song.findByIdAndUpdate(objectId, {
    likeCount,
    dislikeCount,
    commentCount,
    shareCount,
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    ratingCount,
    engagementScore,
    engagementUpdatedAt: new Date(),
  });

  return {
    likeCount,
    dislikeCount,
    commentCount,
    shareCount,
    averageRating,
    ratingCount,
    engagementScore,
  };
}

/**
 * Increment comment count for a song (for real-time updates)
 */
export async function incrementCommentCount(songId: string | mongoose.Types.ObjectId) {
  const objectId = typeof songId === 'string' ? new mongoose.Types.ObjectId(songId) : songId;
  await Song.findByIdAndUpdate(objectId, { $inc: { commentCount: 1 } });
}

/**
 * Decrement comment count for a song (when comment is deleted)
 * Uses $max to prevent negative values in case of race conditions
 */
export async function decrementCommentCount(songId: string | mongoose.Types.ObjectId) {
  const objectId = typeof songId === 'string' ? new mongoose.Types.ObjectId(songId) : songId;
  
  // Decrement but never go below 0 using atomic operation
  await Song.findByIdAndUpdate(
    objectId,
    [
      {
        $set: {
          commentCount: { $max: [{ $subtract: ['$commentCount', 1] }, 0] },
        },
      },
    ]
  );
}

/**
 * Increment share count for a song
 */
export async function incrementShareCount(songId: string | mongoose.Types.ObjectId) {
  const objectId = typeof songId === 'string' ? new mongoose.Types.ObjectId(songId) : songId;
  await Song.findByIdAndUpdate(objectId, { $inc: { shareCount: 1 } });
}

/**
 * Update like counts for a song (call after like/unlike/dislike)
 */
export async function updateLikeCounts(songId: string | mongoose.Types.ObjectId) {
  const objectId = typeof songId === 'string' ? new mongoose.Types.ObjectId(songId) : songId;

  const likeStats = await SongLike.aggregate([
    { $match: { songId: objectId } },
    {
      $group: {
        _id: '$likeType',
        count: { $sum: 1 },
      },
    },
  ]);

  const likeCount = likeStats.find((s) => s._id === 'like')?.count || 0;
  const dislikeCount = likeStats.find((s) => s._id === 'dislike')?.count || 0;

  await Song.findByIdAndUpdate(objectId, { likeCount, dislikeCount });

  return { likeCount, dislikeCount };
}

/**
 * Batch update engagement metrics for multiple songs
 * Use this for background jobs or scheduled tasks
 */
export async function batchUpdateEngagementMetrics(songIds: (string | mongoose.Types.ObjectId)[]) {
  const results = await Promise.allSettled(
    songIds.map((songId) => updateSongEngagementMetrics(songId))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return { successful, failed, total: songIds.length };
}
