/**
 * Comment Controller
 * Handles CRUD operations for song comments
 */

import { Request, Response, NextFunction } from 'express';
import Comment from '../models/Comment.model';
import CommentLike from '../models/CommentLike.model';
import Song from '../models/Song.model';
import { incrementCommentCount, decrementCommentCount } from '../utils/engagement.utils';
import mongoose from 'mongoose';

/**
 * Create a comment on a song
 * POST /api/v1/songs/:songId/comments
 */
export const createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: 'Comment content is required' });
    }

    // Check if song exists
    const song = await Song.findById(songId);
    if (!song) {
      res.status(404).json({ message: 'Song not found' });
    }

    // Create comment
    const comment = await Comment.create({
      userId,
      songId,
      content: content.trim(),
    });

    // Increment comment count
    await incrementCommentCount(songId);

    // Populate user info
    await comment.populate('userId', 'username profilePicture');

    res.status(201).json({
      message: 'Comment created',
      comment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get comments for a song
 * GET /api/v1/songs/:songId/comments?page=1&limit=20
 */
export const getComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { songId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ message: 'Invalid song ID' });
    }

    // Get ALL comments (both top-level and replies) - frontend will organize them
    const [allComments, topLevelCount] = await Promise.all([
      Comment.find({ songId, deletedAt: null })
        .populate('userId', 'username profilePicture')
        .sort({ createdAt: -1 })
        .lean(),
      Comment.countDocuments({ songId, parentCommentId: null, deletedAt: null }),
    ]);

    // Calculate reply counts for each comment
    const replyCountMap = new Map<string, number>();
    allComments.forEach((comment) => {
      if (comment.parentCommentId) {
        const parentId = comment.parentCommentId.toString();
        replyCountMap.set(parentId, (replyCountMap.get(parentId) || 0) + 1);
      }
    });

    // Add like status and reply count for each comment
    const commentsWithLikes = await Promise.all(
      allComments.map(async (comment) => {
        // Check if current user liked this comment
        let userHasLiked = false;
        if (req.user?.id) {
          const liked = await CommentLike.findOne({
            userId: req.user.id,
            commentId: comment._id,
          });
          userHasLiked = !!liked;
        }

        // Add reply count for parent comments
        const replyCount = comment.parentCommentId === null 
          ? (replyCountMap.get(comment._id.toString()) || 0)
          : 0;

        return {
          ...comment,
          userHasLiked,
          replyCount,
        };
      })
    );

    res.json({
      comments: commentsWithLikes,
      pagination: {
        page,
        limit,
        total: topLevelCount,
        pages: Math.ceil(topLevelCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reply to a comment
 * POST /api/v1/comments/:commentId/reply
 */
export const replyToComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ message: 'Invalid comment ID' });
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: 'Reply content is required' });
    }

    // Check if parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment || parentComment.deletedAt) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    // Create reply
    const reply = await Comment.create({
      userId,
      songId: parentComment.songId,
      content: content.trim(),
      parentCommentId: commentId,
    });

    // Increment comment count (replies count as comments)
    await incrementCommentCount(parentComment.songId);

    await reply.populate('userId', 'username profilePicture');

    res.status(201).json({
      message: 'Reply created',
      reply,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get replies for a comment
 * GET /api/v1/comments/:commentId/replies?page=1&limit=10
 */
export const getReplies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ message: 'Invalid comment ID' });
    }

    const [replies, total] = await Promise.all([
      Comment.find({ parentCommentId: commentId, deletedAt: null })
        .populate('userId', 'username profilePicture')
        .sort({ createdAt: 1 }) // Oldest first for replies
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments({ parentCommentId: commentId, deletedAt: null }),
    ]);

    // Check if current user liked each reply
    const repliesWithLikes = await Promise.all(
      replies.map(async (reply) => {
        let userHasLiked = false;
        if (req.user?.id) {
          const liked = await CommentLike.findOne({
            userId: req.user.id,
            commentId: reply._id,
          });
          userHasLiked = !!liked;
        }

        return {
          ...reply,
          userHasLiked,
        };
      })
    );

    res.json({
      replies: repliesWithLikes,
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

/**
 * Edit a comment
 * PATCH /api/v1/comments/:commentId
 */
export const editComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ message: 'Invalid comment ID' });
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await Comment.findById(commentId);

    if (!comment || comment.deletedAt) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    // Check ownership
    if (comment.userId.toString() !== userId) {
      res.status(403).json({ message: 'You can only edit your own comments' });
      return;
    }

    comment.content = content.trim();
    await comment.save();

    await comment.populate('userId', 'username profilePicture');

    res.json({
      message: 'Comment updated',
      comment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a comment (soft delete)
 * DELETE /api/v1/comments/:commentId
 */
export const deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ message: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId);

    if (!comment || comment.deletedAt) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    // Check ownership
    if (comment.userId.toString() !== userId) {
      res.status(403).json({ message: 'You can only delete your own comments' });
      return;
    }

    // Soft delete
    comment.deletedAt = new Date();
    await comment.save();

    // Decrement comment count
    await decrementCommentCount(comment.songId);

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Like a comment
 * POST /api/v1/comments/:commentId/like
 */
export const likeComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ message: 'Invalid comment ID' });
      return;
    }

    const comment = await Comment.findById(commentId);

    if (!comment || comment.deletedAt) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    // Check if already liked
    const existingLike = await CommentLike.findOne({ userId, commentId });

    if (existingLike) {
      // Unlike
      await CommentLike.deleteOne({ _id: existingLike._id });
      comment.likes = Math.max(0, comment.likes - 1);
      await comment.save();

      res.json({
        message: 'Like removed',
        liked: false,
        likes: comment.likes,
      });
    } else {
      // Like
      await CommentLike.create({ userId, commentId });
      comment.likes += 1;
      await comment.save();

      res.status(201).json({
        message: 'Comment liked',
        liked: true,
        likes: comment.likes,
      });
    }
  } catch (error) {
    next(error);
  }
};
