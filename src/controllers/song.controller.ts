import { Response } from 'express';
import Song from '../models/Song.model';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Get all songs with pagination, filtering, and search
 * PUBLIC ENDPOINT - No authentication required
 */
export const discoverSongs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      genre = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      featured = '',
      exclusive = '',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};

    // Search by title or description
    if (search) {
      query.$text = { $search: search as string };
    }

    // Filter by genre
    if (genre) {
      query.genre = genre;
    }

    // Filter by featured
    if (featured === 'true') {
      query.featured = true;
    }

    // Filter by exclusive
    if (exclusive === 'true') {
      query.exclusive = true;
    } else if (exclusive === 'false') {
      query.exclusive = false;
    }

    // Sort options
    const sortOptions: any = {};
    if (sortBy === 'playCount') {
      sortOptions.playCount = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'price') {
      sortOptions.price = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    // Execute query with pagination
    const [songs, total] = await Promise.all([
      Song.find(query)
        .populate('artistId', 'username email avatarUrl')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Song.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    const hasMore = pageNum < totalPages;

    res.status(200).json({
      success: true,
      data: {
        songs,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalSongs: total,
          limit: limitNum,
          hasMore,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch songs',
      error: error.message,
    });
  }
};

/**
 * Get song by ID
 * PUBLIC ENDPOINT
 */
export const getSongById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;

    const song = await Song.findById(songId)
      .populate('artistId', 'username email avatarUrl');

    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { song },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch song',
      error: error.message,
    });
  }
};

/**
 * Get artist's songs
 * PUBLIC ENDPOINT
 */
export const getArtistSongs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { artistId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [songs, total] = await Promise.all([
      Song.find({ artistId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Song.countDocuments({ artistId }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: {
        songs,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalSongs: total,
          limit: limitNum,
          hasMore: pageNum < totalPages,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch artist songs',
      error: error.message,
    });
  }
};

/**
 * Create a new song
 * PROTECTED - Artist only
 */
export const createSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // TODO: Use actual userId from req.user when auth is re-enabled
    // Using valid MongoDB ObjectId format for testing
    const userId = req.user?.userId || '507f1f77bcf86cd799439011';
    const {
      title,
      duration,
      price,
      coverArt,
      audioUrl,
      exclusive,
      genre,
      description,
    } = req.body;

    // Validate required fields
    if (!title || !duration || !audioUrl) {
      res.status(400).json({
        success: false,
        message: 'Title, duration, and audio URL are required',
      });
      return;
    }

    const song = await Song.create({
      artistId: userId,
      title,
      duration,
      price: price || 10,
      coverArt: coverArt || 'https://via.placeholder.com/300', // Provide default if null
      audioUrl,
      exclusive: exclusive || false,
      genre,
      description,
      // Note: status field not in schema, removed
      playCount: 0,
      featured: false,
    });

    res.status(201).json({
      success: true,
      message: 'Song created successfully',
      data: { song },
    });
  } catch (error: any) {
    console.error('Create song error:', error); // More detailed logging
    
    if (error.message.includes('maximum limit')) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create song',
      error: error.message,
      details: error.errors || error, // Add validation details
    });
  }
};

/**
 * Update song
 * PROTECTED - Artist only (own songs)
 */
export const updateSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { songId } = req.params;
    const updates = req.body;

    const song = await Song.findOne({ _id: songId, artistId: userId });

    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found or you do not have permission to update it',
      });
      return;
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'duration', 'price', 'coverArt', 'audioUrl', 'exclusive', 'genre', 'description'];
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        (song as any)[key] = updates[key];
      }
    });

    await song.save();

    res.status(200).json({
      success: true,
      message: 'Song updated successfully',
      data: { song },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update song',
      error: error.message,
    });
  }
};

/**
 * Delete song
 * PROTECTED - Artist only (own songs)
 */
export const deleteSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { songId } = req.params;

    const song = await Song.findOneAndDelete({ _id: songId, artistId: userId });

    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found or you do not have permission to delete it',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Song deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete song',
      error: error.message,
    });
  }
};

/**
 * Increment play count
 * PUBLIC ENDPOINT
 */
export const incrementPlayCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;

    const song = await Song.findByIdAndUpdate(
      songId,
      { $inc: { playCount: 1 } },
      { new: true }
    );

    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { playCount: song.playCount },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to increment play count',
      error: error.message,
    });
  }
};

/**
 * Get available genres
 * PUBLIC ENDPOINT
 */
export const getGenres = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const genres = await Song.distinct('genre');
    
    res.status(200).json({
      success: true,
      data: { genres: genres.filter(g => g) }, // Filter out null/undefined
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch genres',
      error: error.message,
    });
  }
};
