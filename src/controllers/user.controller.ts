import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User.model';
import { Follow } from '../models/Follow';
import Song from '../models/Song.model';
import mongoose from 'mongoose';

export class UserController {
  // Get user profile
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // Validate userId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ success: false, message: 'Invalid user ID' });
        return;
      }

      const user = await User.findById(userId).select('-password -refreshToken');

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Get follow stats
      const [followerCount, followingCount, songCount] = await Promise.all([
        Follow.countDocuments({ followingId: userId }),
        Follow.countDocuments({ followerId: userId }),
        Song.countDocuments({ artistId: userId }),
      ]);

      res.json({
        success: true,
        data: {
          user,
          stats: {
            followerCount,
            followingCount,
            songCount,
          },
        },
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Discover artists with filters and pagination
  async discoverArtists(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const genre = req.query.genre as string;
      const sortBy = (req.query.sortBy as string) || 'followerCount'; // followerCount, songCount, latest
      const currentUserId = req.user?._id; // Get current user ID if authenticated

      const skip = (page - 1) * limit;

      // Build aggregation pipeline
      const pipeline: any[] = [];

      // Match stage - basic filters
      const matchStage: any = {
        role: 'artist', // Only show users with artist role
      };
      
      // Exclude current user from discover results
      if (currentUserId) {
        matchStage._id = { $ne: currentUserId };
      }
      
      if (search) {
        matchStage.$or = [
          { username: { $regex: search, $options: 'i' } },
          { bio: { $regex: search, $options: 'i' } },
        ];
      }

      pipeline.push({ $match: matchStage });

      // Lookup followers
      pipeline.push({
        $lookup: {
          from: 'follows',
          localField: '_id',
          foreignField: 'followingId',
          as: 'followers',
        },
      });

      // Lookup songs
      pipeline.push({
        $lookup: {
          from: 'songs',
          localField: '_id',
          foreignField: 'artistId',
          as: 'songs',
        },
      });

      // Add computed fields
      pipeline.push({
        $addFields: {
          followerCount: { $size: '$followers' },
          songCount: { $size: '$songs' },
          hasExclusiveContent: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$songs',
                    as: 'song',
                    cond: { $eq: ['$$song.exclusive', true] },
                  },
                },
              },
              0,
            ],
          },
        },
      });

      // Filter by genre if provided
      if (genre) {
        pipeline.push({
          $match: {
            'songs.genre': genre,
          },
        });
      }

      // Sort stage
      let sortStage: any = {};
      switch (sortBy) {
        case 'followerCount':
          sortStage = { followerCount: -1, username: 1 };
          break;
        case 'songCount':
          sortStage = { songCount: -1, username: 1 };
          break;
        case 'latest':
          sortStage = { createdAt: -1 };
          break;
        default:
          sortStage = { followerCount: -1 };
      }
      pipeline.push({ $sort: sortStage });

      // Project stage - select fields to return
      pipeline.push({
        $project: {
          password: 0,
          refreshToken: 0,
          followers: 0,
          songs: 0,
        },
      });

      // Execute pipeline with pagination
      const [artists, totalCount] = await Promise.all([
        User.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
        User.aggregate([...pipeline, { $count: 'count' }]).then((r: any) => r[0]?.count || 0),
      ]);

      res.json({
        success: true,
        data: {
          artists,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalArtists: totalCount,
            hasMore: skip + artists.length < totalCount,
          },
        },
      });
    } catch (error) {
      console.error('Discover artists error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Update user profile
  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { username, bio, profilePicture } = req.body;

      // Build update object
      const updateData: any = {};
      if (username) updateData.username = username;
      if (bio !== undefined) updateData.bio = bio;
      if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

      // Check if username is already taken
      if (username) {
        const existingUser = await User.findOne({
          username,
          _id: { $ne: userId },
        });

        if (existingUser) {
          res.status(400).json({ success: false, message: 'Username already taken' });
          return;
        }
      }

      const user = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      }).select('-password -refreshToken');

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get current user profile
  async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;

      const user = await User.findById(userId).select('-password -refreshToken');

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Get follow stats
      const [followerCount, followingCount, songCount] = await Promise.all([
        Follow.countDocuments({ followingId: userId }),
        Follow.countDocuments({ followerId: userId }),
        Song.countDocuments({ artistId: userId }),
      ]);

      res.json({
        success: true,
        data: {
          user,
          stats: {
            followerCount,
            followingCount,
            songCount,
          },
        },
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}
