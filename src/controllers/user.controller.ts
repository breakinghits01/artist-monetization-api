import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User.model';
import { Follow } from '../models/Follow';
import Song from '../models/Song.model';
import mongoose from 'mongoose';
import { getTimeWindow, getFormulaWeights, getAvailableTimeWindows, getAvailableFormulas } from '../config/rising-stars.config';

export class UserController {
  // Get user profile - supports both MongoDB ObjectID and username
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      let user;

      // Try to find by MongoDB ObjectID first (backward compatibility)
      if (mongoose.Types.ObjectId.isValid(userId) && userId.length === 24) {
        user = await User.findById(userId).select('-password -refreshToken');
      }

      // If not found by ID or not a valid ObjectID, try username lookup
      if (!user) {
        // Case-insensitive username lookup for better UX
        user = await User.findOne({ 
          username: new RegExp(`^${userId}$`, 'i') 
        }).select('-password -refreshToken');
      }

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Get follow stats using the resolved user._id
      const [followerCount, followingCount, songCount] = await Promise.all([
        Follow.countDocuments({ followingId: user._id }),
        Follow.countDocuments({ followerId: user._id }),
        Song.countDocuments({ artistId: user._id }),
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
      const sortBy = (req.query.sortBy as string) || 'followerCount'; // followerCount, songCount, latest, risingScore
      const currentUserId = req.user?._id; // Get current user ID if authenticated
      
      // Rising Stars query parameters (optional)
      const timeWindow = req.query.timeWindow as string; // e.g., '7d', '30d', '90d'
      const formula = req.query.formula as string; // e.g., 'balanced', 'viral', 'engaged'

      const skip = (page - 1) * limit;

      // Build aggregation pipeline
      const pipeline: any[] = [];

      // Match stage - basic filters
      const matchStage: any = {
        role: 'artist', // Only show users with artist role
      };
      
      // Exclude current user from discover results (except for risingScore rankings)
      if (currentUserId && sortBy !== 'risingScore') {
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

      // Sort stage - Multi-criteria ranking for better results
      let sortStage: any = {};
      switch (sortBy) {
        case 'followerCount':
          // Popular artists: followers → songs → newest
          sortStage = { followerCount: -1, songCount: -1, createdAt: -1 };
          break;
        case 'songCount':
          // Rising artists: content volume → popularity → newest
          // Prioritizes active content creators over passive accounts
          sortStage = { songCount: -1, followerCount: -1, createdAt: -1 };
          break;
        case 'latest':
          // New artists: newest → songs → followers
          sortStage = { createdAt: -1, songCount: -1, followerCount: -1 };
          break;
        case 'risingScore':
          // Rising Stars: Configurable engagement-based scoring
          // Uses centralized config for weights and time windows
          // @see src/config/rising-stars.config.ts
          
          // Get configuration values
          const timeWindowMs = getTimeWindow(timeWindow);
          const weights = getFormulaWeights(formula);
          const cutoffDate = new Date(Date.now() - timeWindowMs);
          
          // Lookup recent followers (configurable time window)
          pipeline.push({
            $lookup: {
              from: 'follows',
              let: { artistId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$followingId', '$$artistId'] },
                        { $gte: ['$createdAt', cutoffDate] }
                      ]
                    }
                  }
                }
              ],
              as: 'recentFollows'
            }
          });
          
          // Lookup recent likes on artist's songs (configurable time window)
          pipeline.push({
            $lookup: {
              from: 'songlikes',
              let: { songIds: '$songs._id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $in: ['$songId', '$$songIds'] },
                        { $eq: ['$likeType', 'like'] },
                        { $gte: ['$createdAt', cutoffDate] }
                      ]
                    }
                  }
                }
              ],
              as: 'recentLikes'
            }
          });
          
          // Lookup recent comments on artist's songs (configurable time window)
          pipeline.push({
            $lookup: {
              from: 'comments',
              let: { songIds: '$songs._id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $in: ['$songId', '$$songIds'] },
                        { $gte: ['$createdAt', cutoffDate] }
                      ]
                    }
                  }
                }
              ],
              as: 'recentComments'
            }
          });
          
          // Lookup recent shares on artist's songs (configurable time window)
          pipeline.push({
            $lookup: {
              from: 'songshares',
              let: { songIds: '$songs._id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $in: ['$songId', '$$songIds'] },
                        { $gte: ['$createdAt', cutoffDate] }
                      ]
                    }
                  }
                }
              ],
              as: 'recentShares'
            }
          });
          
          // Calculate Rising Score with configurable weights
          // Formula uses weights from config for easy tuning
          pipeline.push({
            $addFields: {
              recentFollowerCount: { $size: '$recentFollows' },
              recentLikesCount: { $size: '$recentLikes' },
              recentCommentsCount: { $size: '$recentComments' },
              recentSharesCount: { $size: '$recentShares' },
              risingScore: {
                $add: [
                  { $multiply: [{ $size: '$recentFollows' }, weights.follower] },
                  { $multiply: [{ $size: '$recentLikes' }, weights.like] },
                  { $multiply: [{ $size: '$recentComments' }, weights.comment] },
                  { $multiply: [{ $size: '$recentShares' }, weights.share] }
                ]
              }
            }
          });
          
          // Sort by risingScore (descending), then by total followers as tiebreaker
          sortStage = { risingScore: -1, followerCount: -1 };
          break;
        default:
          // Default: balanced ranking
          sortStage = { followerCount: -1, songCount: -1 };
      }
      pipeline.push({ $sort: sortStage });

      // Project stage - select fields to return (exclude sensitive data and temporary arrays)
      const projectStage: any = {
        password: 0,
        refreshToken: 0,
        followers: 0,
        songs: 0,
      };
      
      // For risingScore, also exclude the temporary engagement arrays
      if (sortBy === 'risingScore') {
        projectStage.recentFollows = 0;
        projectStage.recentLikes = 0;
        projectStage.recentComments = 0;
        projectStage.recentShares = 0;
      }
      
      pipeline.push({ $project: projectStage });

      // Execute pipeline with pagination
      const [artists, totalCount] = await Promise.all([
        User.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
        User.aggregate([...pipeline, { $count: 'count' }]).then((r: any) => r[0]?.count || 0),
      ]);

      // Build response with metadata
      const response: any = {
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
      };

      // Add Rising Stars metadata if using risingScore sort
      if (sortBy === 'risingScore') {
        response.data.risingStarsConfig = {
          timeWindow: timeWindow || '30d',
          formula: formula || 'balanced',
          availableTimeWindows: getAvailableTimeWindows(),
          availableFormulas: getAvailableFormulas(),
        };
      }

      res.json(response);
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
