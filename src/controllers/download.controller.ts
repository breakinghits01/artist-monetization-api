import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { DownloadService } from '../services/download.service';
import SystemSettings from '../models/SystemSettings.model';

/**
 * Download a song in specified format
 * GET /api/download/song/:songId?format=mp3
 */
export const downloadSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { songId } = req.params;
    const format = (req.query.format as string) || 'mp3';

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Check rate limit (configurable via CMS > System Settings > Security > max_downloads_per_hour)
    const maxDownloadsPerHour = await SystemSettings.getSetting('max_downloads_per_hour', 200);
    const rateLimit = await DownloadService.checkRateLimit(userId, maxDownloadsPerHour);
    if (!rateLimit.allowed) {
      res.status(429).json({
        success: false,
        message: 'Download rate limit exceeded. Please try again later.',
        data: {
          count: rateLimit.count,
          resetAt: rateLimit.resetAt,
        },
      });
      return;
    }

    // Check download permission
    const permission = await DownloadService.checkDownloadPermission(userId, songId);
    if (!permission.allowed) {
      res.status(403).json({
        success: false,
        message: permission.reason || 'Download not allowed',
      });
      return;
    }

    // Get download URL
    const downloadData = await DownloadService.getDownloadUrl(songId, format);
    if (!downloadData) {
      res.status(404).json({
        success: false,
        message: `Format '${format}' not available for this song`,
      });
      return;
    }

    // Don't track download here - only track when confirmed via /confirm endpoint
    // This prevents tracking when users cancel the download

    // Return download URL (redirect to file)
    res.status(200).json({
      success: true,
      message: 'Download ready',
      data: {
        downloadUrl: downloadData.url,
        format,
        fileSize: downloadData.fileSize,
        song: permission.song,
      },
    });
  } catch (error: any) {
    console.error('❌ Error downloading song:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process download',
      error: error.message,
    });
  }
};

/**
 * Get available download formats for a song
 * GET /api/download/song/:songId/formats
 */
export const getAvailableFormats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { songId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Check download permission
    const permission = await DownloadService.checkDownloadPermission(userId, songId);
    if (!permission.allowed) {
      res.status(403).json({
        success: false,
        message: permission.reason || 'Download not allowed',
      });
      return;
    }

    // Get available formats
    const formats = await DownloadService.getAvailableFormats(songId);

    res.status(200).json({
      success: true,
      data: { formats },
    });
  } catch (error: any) {
    console.error('❌ Error getting available formats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available formats',
      error: error.message,
    });
  }
};

/**
 * Get user's download history
 * GET /api/download/history?limit=50
 */
export const getDownloadHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const history = await DownloadService.getUserDownloadHistory(userId, limit);

    res.status(200).json({
      success: true,
      data: { history },
    });
  } catch (error: any) {
    console.error('❌ Error getting download history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get download history',
      error: error.message,
    });
  }
};

/**
 * Get download statistics for a song (artist only)
 * GET /api/download/stats/:songId
 */
export const getSongDownloadStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { songId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Check if user is the artist (permission check will verify)
    const permission = await DownloadService.checkDownloadPermission(userId, songId);
    if (!permission.song || permission.song.artistId._id.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the artist can view download statistics',
      });
      return;
    }

    const stats = await DownloadService.getSongDownloadStats(songId);

    res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error: any) {
    console.error('❌ Error getting download stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get download statistics',
      error: error.message,
    });
  }
};

/**
 * Confirm download (track after user actually downloads)
 * POST /api/download/song/:songId/confirm
 */
export const confirmDownload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { songId } = req.params;
    const { format, fileSize } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Track download
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    await DownloadService.trackDownload(
      userId,
      songId,
      format || 'mp3',
      fileSize || 0,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: 'Download confirmed',
    });
  } catch (error: any) {
    console.error('❌ Error confirming download:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm download',
      error: error.message,
    });
  }
};
