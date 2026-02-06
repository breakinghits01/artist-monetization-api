import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Activity, ActivityType } from '../models/Activity';
import { Follow } from '../models/Follow';
import mongoose from 'mongoose';

export class ActivityController {
  // Get activity feed for current user (from artists they follow)
  async getActivityFeed(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as ActivityType | undefined;

      const skip = (page - 1) * limit;

      // Get list of artists the user follows
      const following = await Follow.find({ followerId: userId })
        .select('followingId')
        .lean();

      const followingIds = following.map((f) => f.followingId);

      if (followingIds.length === 0) {
        res.json({
          success: true,
          data: {
            activities: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalActivities: 0,
              hasMore: false,
            },
          },
        });
        return;
      }

      // Build query
      const query: any = { userId: { $in: followingIds } };
      if (type) {
        query.type = type;
      }

      // Get activities from followed artists
      const activities = await Activity.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', '_id username email profilePicture')
        .populate({
          path: 'targetId',
          select: '_id title name coverArt username', // Generic fields that might exist
        })
        .lean();

      const totalActivities = await Activity.countDocuments(query);

      res.json({
        success: true,
        data: {
          activities,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalActivities / limit),
            totalActivities,
            hasMore: skip + activities.length < totalActivities,
          },
        },
      });
    } catch (error) {
      console.error('Get activity feed error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Create a new activity (internal use - called by other controllers)
  async createActivity(
    userId: mongoose.Types.ObjectId | string,
    type: ActivityType,
    targetId: mongoose.Types.ObjectId | string,
    targetModel: 'User' | 'Song' | 'Bundle',
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await Activity.create({
        userId,
        type,
        targetId,
        targetModel,
        message,
        metadata,
      });
    } catch (error) {
      console.error('Create activity error:', error);
      // Don't throw error - activity creation shouldn't break main flow
    }
  }

  // Get user's own activities
  async getUserActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      // Validate userId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ success: false, message: 'Invalid user ID' });
        return;
      }

      const skip = (page - 1) * limit;

      const activities = await Activity.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'targetId',
          select: '_id title name coverArt username',
        })
        .lean();

      const totalActivities = await Activity.countDocuments({ userId });

      res.json({
        success: true,
        data: {
          activities,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalActivities / limit),
            totalActivities,
            hasMore: skip + activities.length < totalActivities,
          },
        },
      });
    } catch (error) {
      console.error('Get user activities error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Delete an activity
  async deleteActivity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { activityId } = req.params;
      const userId = req.user!._id;

      // Validate activityId
      if (!mongoose.Types.ObjectId.isValid(activityId)) {
        res.status(400).json({ success: false, message: 'Invalid activity ID' });
        return;
      }

      // Only allow deleting own activities
      const activity = await Activity.findOneAndDelete({
        _id: activityId,
        userId,
      });

      if (!activity) {
        res.status(404).json({ success: false, message: 'Activity not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Activity deleted successfully',
      });
    } catch (error) {
      console.error('Delete activity error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}

// Export singleton instance for use in other controllers
export const activityController = new ActivityController();
