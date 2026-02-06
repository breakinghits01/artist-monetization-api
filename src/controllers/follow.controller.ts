import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Follow } from '../models/Follow';
import User from '../models/User.model';
import mongoose from 'mongoose';

export class FollowController {
  // Follow an artist
  async followArtist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { artistId } = req.params;
      const followerId = req.user!._id;

      // Validate artistId
      if (!mongoose.Types.ObjectId.isValid(artistId)) {
        res.status(400).json({ success: false, message: 'Invalid artist ID' });
        return;
      }

      // Check if artist exists
      const artist = await User.findById(artistId);
      if (!artist) {
        res.status(404).json({ success: false, message: 'Artist not found' });
        return;
      }

      // Prevent self-following
      if (followerId.toString() === artistId) {
        res.status(400).json({ success: false, message: 'You cannot follow yourself' });
        return;
      }

      // Check if already following
      const existingFollow = await Follow.findOne({
        followerId,
        followingId: artistId,
      });

      if (existingFollow) {
        res.status(400).json({ success: false, message: 'Already following this artist' });
        return;
      }

      // Create follow relationship
      const follow = await Follow.create({
        followerId,
        followingId: artistId,
      });

      res.status(201).json({
        success: true,
        message: 'Successfully followed artist',
        data: { follow },
      });
    } catch (error) {
      console.error('Follow artist error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Unfollow an artist
  async unfollowArtist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { artistId } = req.params;
      const followerId = req.user!._id;

      // Validate artistId
      if (!mongoose.Types.ObjectId.isValid(artistId)) {
        res.status(400).json({ success: false, message: 'Invalid artist ID' });
        return;
      }

      // Delete follow relationship
      const result = await Follow.findOneAndDelete({
        followerId,
        followingId: artistId,
      });

      if (!result) {
        res.status(404).json({ success: false, message: 'Follow relationship not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Successfully unfollowed artist',
      });
    } catch (error) {
      console.error('Unfollow artist error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get followers of a user
  async getFollowers(req: AuthRequest, res: Response): Promise<void> {
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

      // Get followers with user details and stats
      const followers = await Follow.find({ followingId: userId })
        .sort({ followedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('followerId', 'username email profilePicture bio createdAt')
        .lean();

      const totalFollowers = await Follow.countDocuments({ followingId: userId });

      // Enrich with follower/following counts and song count
      const enrichedFollowers = await Promise.all(
        followers.map(async (f: any) => {
          const user = f.followerId;
          if (!user) return null;

          const [followerCount, followingCount, songCount] = await Promise.all([
            Follow.countDocuments({ followingId: user._id }),
            Follow.countDocuments({ followerId: user._id }),
            mongoose.connection.collection('songs').countDocuments({ artistId: user._id }),
          ]);

          return {
            ...user,
            followerCount,
            followingCount,
            songCount,
            hasExclusiveContent: songCount > 0,
          };
        })
      );

      res.json({
        success: true,
        data: {
          followers: enrichedFollowers.filter((f) => f !== null),
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalFollowers / limit),
            totalFollowers,
            hasMore: skip + followers.length < totalFollowers,
          },
        },
      });
    } catch (error) {
      console.error('Get followers error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get users that a user is following
  async getFollowing(req: AuthRequest, res: Response): Promise<void> {
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

      // Get following with user details and stats
      const following = await Follow.find({ followerId: userId })
        .sort({ followedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('followingId', 'username email profilePicture bio createdAt')
        .lean();

      const totalFollowing = await Follow.countDocuments({ followerId: userId });

      // Enrich with follower/following counts and song count
      const enrichedFollowing = await Promise.all(
        following.map(async (f: any) => {
          const user = f.followingId;
          if (!user) return null;

          const [followerCount, followingCount, songCount] = await Promise.all([
            Follow.countDocuments({ followingId: user._id }),
            Follow.countDocuments({ followerId: user._id }),
            mongoose.connection.collection('songs').countDocuments({ artistId: user._id }),
          ]);

          return {
            ...user,
            followerCount,
            followingCount,
            songCount,
            hasExclusiveContent: songCount > 0,
          };
        })
      );

      res.json({
        success: true,
        data: {
          following: enrichedFollowing.filter((f) => f !== null),
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalFollowing / limit),
            totalFollowing,
            hasMore: skip + following.length < totalFollowing,
          },
        },
      });
    } catch (error) {
      console.error('Get following error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Check if current user follows a specific artist
  async checkFollowStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { artistId } = req.params;
      const followerId = req.user!._id;

      // Validate artistId
      if (!mongoose.Types.ObjectId.isValid(artistId)) {
        res.status(400).json({ success: false, message: 'Invalid artist ID' });
        return;
      }

      const isFollowing = await Follow.exists({
        followerId,
        followingId: artistId,
      });

      res.json({
        success: true,
        data: {
          isFollowing: !!isFollowing,
        },
      });
    } catch (error) {
      console.error('Check follow status error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get follower and following counts for a user
  async getFollowStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // Validate userId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ success: false, message: 'Invalid user ID' });
        return;
      }

      const [followerCount, followingCount] = await Promise.all([
        Follow.countDocuments({ followingId: userId }),
        Follow.countDocuments({ followerId: userId }),
      ]);

      res.json({
        success: true,
        data: {
          followerCount,
          followingCount,
        },
      });
    } catch (error) {
      console.error('Get follow stats error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}
