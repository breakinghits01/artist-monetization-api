import { Response } from 'express';
import Playlist from '../models/Playlist.model';
import Song from '../models/Song.model';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Get user's playlists
 * PROTECTED - Get playlists for authenticated user
 */
export const getUserPlaylists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || req.params.userId;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [playlists, total] = await Promise.all([
      Playlist.find({ userId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Playlist.countDocuments({ userId }),
    ]);

    // Fix songCount for each playlist by checking actual valid songs
    const playlistsWithValidCounts = await Promise.all(
      playlists.map(async (playlist: any) => {
        // Check if songs array has valid references
        if (playlist.songs && playlist.songs.length > 0) {
          const validSongsCount = await Song.countDocuments({
            _id: { $in: playlist.songs },
          });
          
          // Update if count doesn't match
          if (validSongsCount !== playlist.songCount) {
            await Playlist.findByIdAndUpdate(playlist._id, {
              songCount: validSongsCount,
            });
            playlist.songCount = validSongsCount;
          }
        } else if (playlist.songCount > 0) {
          // No songs but count > 0, fix it
          await Playlist.findByIdAndUpdate(playlist._id, {
            songCount: 0,
          });
          playlist.songCount = 0;
        }
        return playlist;
      })
    );

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: {
        playlists: playlistsWithValidCounts,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalPlaylists: total,
          limit: limitNum,
          hasMore: pageNum < totalPages,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch playlists',
      error: error.message,
    });
  }
};

/**
 * Get playlist by ID with songs populated
 */
export const getPlaylistById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.params;

    const playlist = await Playlist.findById(playlistId)
      .populate({
        path: 'songs',
        select: 'title artistId duration coverArt audioUrl genre price',
        populate: {
          path: 'artistId',
          select: 'username email avatarUrl'
        }
      })
      .lean();

    if (!playlist) {
      res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
      return;
    }

    // Filter out null/undefined songs (deleted songs)
    const validSongs = playlist.songs?.filter((song: any) => song != null) || [];
    
    // Update songCount to match actual valid songs
    const actualCount = validSongs.length;
    
    // If songCount doesn't match, update it in the database
    if (playlist.songCount !== actualCount) {
      await Playlist.findByIdAndUpdate(playlistId, {
        songCount: actualCount,
        songs: validSongs.map((s: any) => s._id),
      });
    }

    res.status(200).json({
      success: true,
      data: { 
        playlist: {
          ...playlist,
          songs: validSongs,
          songCount: actualCount,
        }
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch playlist',
      error: error.message,
    });
  }
};

/**
 * Create new playlist
 * PROTECTED
 */
export const createPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || '6982bda1b7a73570da690db9'; // Fallback for testing
    const { name, description, coverImage, isPublic } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Playlist name is required',
      });
      return;
    }

    const playlist = await Playlist.create({
      userId,
      name,
      description,
      coverImage,
      isPublic: isPublic !== undefined ? isPublic : true,
      songs: [],
      songCount: 0,
    });

    res.status(201).json({
      success: true,
      message: 'Playlist created successfully',
      data: { playlist },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create playlist',
      error: error.message,
    });
  }
};

/**
 * Update playlist
 * PROTECTED - Owner only
 */
export const updatePlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || '6982bda1b7a73570da690db9';
    const { playlistId } = req.params;
    const updates = req.body;

    const playlist = await Playlist.findOne({ _id: playlistId, userId });

    if (!playlist) {
      res.status(404).json({
        success: false,
        message: 'Playlist not found or you do not have permission',
      });
      return;
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'description', 'coverImage', 'isPublic'];
    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        (playlist as any)[field] = updates[field];
      }
    });

    await playlist.save();

    res.status(200).json({
      success: true,
      message: 'Playlist updated successfully',
      data: { playlist },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update playlist',
      error: error.message,
    });
  }
};

/**
 * Delete playlist
 * PROTECTED - Owner only
 */
export const deletePlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || '6982bda1b7a73570da690db9';
    const { playlistId } = req.params;

    const playlist = await Playlist.findOneAndDelete({ _id: playlistId, userId });

    if (!playlist) {
      res.status(404).json({
        success: false,
        message: 'Playlist not found or you do not have permission',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Playlist deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete playlist',
      error: error.message,
    });
  }
};

/**
 * Add song to playlist
 * PROTECTED
 */
export const addSongToPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || '6982bda1b7a73570da690db9';
    const { playlistId, songId } = req.params;

    // Verify song exists
    const song = await Song.findById(songId);
    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found',
      });
      return;
    }

    // Find playlist
    const playlist = await Playlist.findOne({ _id: playlistId, userId });
    if (!playlist) {
      res.status(404).json({
        success: false,
        message: 'Playlist not found or you do not have permission',
      });
      return;
    }

    // Check if song already in playlist
    if (playlist.songs.includes(songId as any)) {
      res.status(400).json({
        success: false,
        message: 'Song already in playlist',
      });
      return;
    }

    // Add song
    playlist.songs.push(songId as any);
    await playlist.save();

    res.status(200).json({
      success: true,
      message: 'Song added to playlist',
      data: { playlist },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to add song to playlist',
      error: error.message,
    });
  }
};

/**
 * Remove song from playlist
 * PROTECTED
 */
export const removeSongFromPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || '6982bda1b7a73570da690db9';
    const { playlistId, songId } = req.params;

    const playlist = await Playlist.findOne({ _id: playlistId, userId });
    if (!playlist) {
      res.status(404).json({
        success: false,
        message: 'Playlist not found or you do not have permission',
      });
      return;
    }

    // Remove song
    playlist.songs = playlist.songs.filter(
      (id) => id.toString() !== songId
    );
    await playlist.save();

    res.status(200).json({
      success: true,
      message: 'Song removed from playlist',
      data: { playlist },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove song from playlist',
      error: error.message,
    });
  }
};
