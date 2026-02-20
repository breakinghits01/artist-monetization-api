import Song from '../models/Song.model';
import DownloadHistory from '../models/DownloadHistory.model';
import Purchase from '../models/Purchase.model';
import mongoose from 'mongoose';

/**
 * Download Service
 * Handles song download permissions, format selection, and tracking
 */
export class DownloadService {
  /**
   * Check if user can download a song
   * @param userId - User ID
   * @param songId - Song ID
   * @returns Permission result with reason
   */
  static async checkDownloadPermission(
    userId: string,
    songId: string
  ): Promise<{ allowed: boolean; reason?: string; song?: any }> {
    try {
      const song = await Song.findById(songId).populate('artistId', 'username');

      if (!song) {
        return { allowed: false, reason: 'Song not found' };
      }

      // Check if downloads are enabled for this song
      if (song.downloadEnabled === false) {
        return { allowed: false, reason: 'Downloads are disabled for this song' };
      }

      // Artist can always download their own songs
      if (song.artistId._id.toString() === userId) {
        return { allowed: true, song };
      }

      // Check if user has purchased the song
      const purchase = await Purchase.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        songId: new mongoose.Types.ObjectId(songId),
      });

      if (!purchase) {
        return {
          allowed: false,
          reason: 'You must purchase this song to download it',
        };
      }

      // Check premium-only restriction
      if (song.premiumDownloadOnly) {
        // TODO: Check if user has premium subscription
        // For now, allow if they purchased the song
        return { allowed: true, song };
      }

      return { allowed: true, song };
    } catch (error: any) {
      console.error('Error checking download permission:', error);
      return { allowed: false, reason: 'Failed to verify download permissions' };
    }
  }

  /**
   * Get available download formats for a song
   * @param songId - Song ID
   * @returns Array of available formats with metadata
   */
  static async getAvailableFormats(
    songId: string
  ): Promise<
    Array<{
      format: string;
      bitrate?: number;
      fileSize?: number;
      quality: string;
    }>
  > {
    try {
      const song = await Song.findById(songId);

      if (!song) {
        return [];
      }

      const formats: Array<{
        format: string;
        bitrate?: number;
        fileSize?: number;
        quality: string;
      }> = [];

      // MP3 is always available (streaming version)
      formats.push({
        format: 'mp3',
        bitrate: song.audioBitrate || 320,
        fileSize: song.audioFileSize,
        quality: 'High Quality (MP3 320kbps)',
      });

      // Add original format if available
      if (song.originalAudioUrl && song.originalFormat) {
        formats.push({
          format: song.originalFormat,
          bitrate: song.originalBitrate,
          fileSize: song.originalFileSize,
          quality: `Lossless (${song.originalFormat.toUpperCase()})`,
        });
      }

      return formats;
    } catch (error: any) {
      console.error('Error getting available formats:', error);
      return [];
    }
  }

  /**
   * Get download URL for a song in specified format
   * @param songId - Song ID
   * @param format - Requested format (mp3, wav, flac, etc.)
   * @returns Download URL or null
   */
  static async getDownloadUrl(
    songId: string,
    format: string
  ): Promise<{ url: string; fileSize?: number } | null> {
    try {
      const song = await Song.findById(songId);

      if (!song) {
        return null;
      }

      // MP3 format - return streaming URL
      if (format === 'mp3') {
        return {
          url: song.audioUrl,
          fileSize: song.audioFileSize,
        };
      }

      // Original format - return original URL
      if (format === song.originalFormat && song.originalAudioUrl) {
        return {
          url: song.originalAudioUrl,
          fileSize: song.originalFileSize,
        };
      }

      // Format not available
      return null;
    } catch (error: any) {
      console.error('Error getting download URL:', error);
      return null;
    }
  }

  /**
   * Track download in history and increment counter
   * @param userId - User ID
   * @param songId - Song ID
   * @param format - Downloaded format
   * @param fileSize - File size in bytes
   * @param ipAddress - User IP address
   * @param userAgent - User agent string
   */
  static async trackDownload(
    userId: string,
    songId: string,
    format: string,
    fileSize: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Create download history record
      await DownloadHistory.create({
        userId: new mongoose.Types.ObjectId(userId),
        songId: new mongoose.Types.ObjectId(songId),
        format,
        fileSize,
        ipAddress,
        userAgent,
      });

      // Increment download count on song
      await Song.findByIdAndUpdate(songId, {
        $inc: { downloadCount: 1 },
      });

      console.log(`✅ Download tracked: Song ${songId}, Format ${format}, User ${userId}`);
    } catch (error: any) {
      console.error('Error tracking download:', error);
      // Don't throw - tracking failure shouldn't block download
    }
  }

  /**
   * Check download rate limit for user
   * @param userId - User ID
   * @param maxDownloadsPerHour - Maximum downloads allowed per hour
   * @returns Rate limit result
   */
  static async checkRateLimit(
    userId: string,
    maxDownloadsPerHour: number = 10
  ): Promise<{ allowed: boolean; count?: number; resetAt?: Date }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const recentDownloads = await DownloadHistory.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        downloadedAt: { $gte: oneHourAgo },
      });

      if (recentDownloads >= maxDownloadsPerHour) {
        return {
          allowed: false,
          count: recentDownloads,
          resetAt: new Date(Date.now() + 60 * 60 * 1000),
        };
      }

      return {
        allowed: true,
        count: recentDownloads,
      };
    } catch (error: any) {
      console.error('Error checking rate limit:', error);
      // Allow download if rate limit check fails
      return { allowed: true };
    }
  }

  /**
   * Get download history for a user
   * @param userId - User ID
   * @param limit - Number of records to return
   * @returns Array of download history records
   */
  static async getUserDownloadHistory(
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const history = await DownloadHistory.find({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .sort({ downloadedAt: -1 })
        .limit(limit)
        .populate('songId', 'title artistId coverArt')
        .populate({
          path: 'songId',
          populate: {
            path: 'artistId',
            select: 'username',
          },
        });

      return history;
    } catch (error: any) {
      console.error('Error getting download history:', error);
      return [];
    }
  }

  /**
   * Get download statistics for a song
   * @param songId - Song ID
   * @returns Download statistics
   */
  static async getSongDownloadStats(songId: string): Promise<{
    totalDownloads: number;
    formatBreakdown: Record<string, number>;
    recentDownloads: number;
  }> {
    try {
      const totalDownloads = await DownloadHistory.countDocuments({
        songId: new mongoose.Types.ObjectId(songId),
      });

      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentDownloads = await DownloadHistory.countDocuments({
        songId: new mongoose.Types.ObjectId(songId),
        downloadedAt: { $gte: last30Days },
      });

      // Get format breakdown
      const formatAgg = await DownloadHistory.aggregate([
        { $match: { songId: new mongoose.Types.ObjectId(songId) } },
        { $group: { _id: '$format', count: { $sum: 1 } } },
      ]);

      const formatBreakdown: Record<string, number> = {};
      formatAgg.forEach((item) => {
        formatBreakdown[item._id] = item.count;
      });

      return {
        totalDownloads,
        formatBreakdown,
        recentDownloads,
      };
    } catch (error: any) {
      console.error('Error getting download stats:', error);
      return {
        totalDownloads: 0,
        formatBreakdown: {},
        recentDownloads: 0,
      };
    }
  }
}
