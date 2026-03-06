import { Response } from 'express';
import mongoose from 'mongoose';
import Song from '../models/Song.model';
import PlaySession from '../models/PlaySession.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { LegacyUploadService } from '../services/legacy-upload.service';
import { R2StorageManager } from '../services/r2-storage-manager.service';
import { AudioConverterService } from '../services/audio-converter.service';
import { deleteFromR2, extractFileNameFromR2Url } from '../config/r2';
import * as path from 'path';

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

    // Search by title or artist username (partial match with regex)
    if (search) {
      const searchRegex = new RegExp(search as string, 'i'); // Case-insensitive
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
      ];
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
      .populate('artistId', 'username email avatarUrl')
      .lean();

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
 * Get artist's songs - supports both MongoDB ObjectID and username
 * PUBLIC ENDPOINT
 */
export const getArtistSongs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { artistId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    let resolvedArtistId: any;

    // Try to find artist by MongoDB ObjectID first (backward compatibility)
    if (mongoose.Types.ObjectId.isValid(artistId) && artistId.length === 24) {
      resolvedArtistId = artistId;
    } else {
      // Try username lookup
      const User = (await import('../models/User.model')).default;
      const user = await User.findOne({ 
        username: new RegExp(`^${artistId}$`, 'i') 
      }).select('_id');
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Artist not found',
        });
        return;
      }
      
      resolvedArtistId = user._id;
    }

    const [songs, total] = await Promise.all([
      Song.find({ artistId: resolvedArtistId })
        .populate('artistId', 'username email avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Song.countDocuments({ artistId: resolvedArtistId }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    // Disable caching for artist songs to ensure fresh data after uploads
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

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
    // Extract userId from JWT token manually since protect middleware is disabled
    let userId = req.user?.userId;
    
    if (!userId && req.headers.authorization?.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        userId = decoded.userId;
        console.log('✅ Extracted userId from token:', userId);
      } catch (error) {
        console.error('❌ Failed to decode JWT token:', error);
      }
    }
    
    // Fallback only if still no userId
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
      });
      return;
    }
    
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

    // Beautiful gradient placeholder matching app theme (purple/pink gradient with music icon)
    const defaultCoverArt = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM5YzI3YjA7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOTFlYzc7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNnKSIvPjxnIG9wYWNpdHk9IjAuMyI+PHBhdGggZD0iTTE1MCw4MGMyNywwLDUwLDIyLDUwLDUwczAsNTAtNTAsNTBzLTUwLTIyLTUwLTUwUzEyMyw4MCwxNTAsODBaIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTE1MCwxMTBjMTEsMCwyMCw5LDIwLDIwczAsMjAtMjAsMjBzLTIwLTktMjAtMjBTMTM5LDExMCwxNTAsMTEwWiIgZmlsbD0iIzljMjdiMCIvPjxwYXRoIGQ9Ik0xNTAsMjAwYy0yNywwLTUwLTIyLTUwLTUwczIzLTUwLDUwLTUwczUwLDIyLDUwLDUwUzE3NywyMDAsMTUwLDIwMFptMC04MGMtMTEsMC0yMCw5LTIwLDIwczksyDAsMjAsMjAtOSwyMC0yMFMxNjEsMTM5LDE1MCwxMjBaIiBmaWxsPSIjZmZmIi8+PC9nPjwvc3ZnPg==';
    
    const song = await Song.create({
      artistId: userId,
      title,
      duration,
      price: price || 10,
      coverArt: coverArt || defaultCoverArt,
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
    // Extract userId from JWT token manually since protect middleware is disabled
    let userId = req.user?.userId;
    
    if (!userId && req.headers.authorization?.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        userId = decoded.userId;
        console.log('✅ Extracted userId from token for delete:', userId);
      } catch (error) {
        console.error('❌ Failed to decode JWT token:', error);
      }
    }
    
    const { songId } = req.params;

    const song = await Song.findOne({ _id: songId, artistId: userId });

    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found or you do not have permission to delete it',
      });
      return;
    }

    // Delete audio file from R2 (if it's an R2 URL)
    if (song.audioUrl.includes('.r2.dev') || song.audioUrl.includes('.r2.cloudflarestorage.com')) {
      try {
        const fileName = extractFileNameFromR2Url(song.audioUrl);
        if (fileName) {
          await deleteFromR2(fileName);
          console.log(`✅ Deleted audio from R2: ${fileName}`);
        }
      } catch (error) {
        console.error('⚠️ Failed to delete from R2 (non-critical):', error);
        // Continue with database deletion even if R2 delete fails
      }
    }

    // Delete from database
    await Song.findByIdAndDelete(songId);

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
/**
 * Start a play session for a song
 * PROTECTED ENDPOINT
 */
export const startPlaySession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Verify song exists
    const song = await Song.findById(songId);
    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found',
      });
      return;
    }

    // Create new play session
    const session = await PlaySession.create({
      userId,
      songId,
      startedAt: new Date(),
      progress: 0,
      completed: false,
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session._id,
        songId: session.songId,
        startedAt: session.startedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to start play session',
      error: error.message,
    });
  }
};

/**
 * Increment play count (requires valid session at 50%+ progress)
 * PROTECTED ENDPOINT
 */
export const incrementPlayCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Find the most recent active session for this user and song
    const recentSession = await PlaySession.findOne({
      userId,
      songId,
      incrementedAt: null, // Not yet incremented
      startedAt: { $gte: new Date(Date.now() - 3600000) }, // Within last hour
    })
      .sort({ startedAt: -1 })
      .limit(1);

    if (!recentSession) {
      res.status(400).json({
        success: false,
        message: 'No active play session found. Start playing the song first.',
      });
      return;
    }

    // Get song to check duration
    const song = await Song.findById(songId);
    if (!song) {
      res.status(404).json({
        success: false,
        message: 'Song not found',
      });
      return;
    }

    // Calculate 50% threshold based on song duration
    const sessionAge = Date.now() - recentSession.startedAt.getTime();
    const minimumListenTime = Math.max(
      (song.duration * 1000 * 0.5), // 50% of song duration
      5000 // Minimum 5 seconds (spam prevention for very short songs)
    );

    if (sessionAge < minimumListenTime) {
      const requiredSeconds = Math.ceil(minimumListenTime / 1000);
      res.status(400).json({
        success: false,
        message: `Must listen to at least 50% of the song (${requiredSeconds}s) before count increments.`,
      });
      return;
    }

    // Mark session as incremented
    recentSession.incrementedAt = new Date();
    recentSession.progress = 0.5; // Mark as 50% completion
    await recentSession.save();

    // Increment the play count
    const updatedSong = await Song.findByIdAndUpdate(
      songId,
      { $inc: { playCount: 1 } },
      { new: true }
    );

    if (!updatedSong) {
      res.status(404).json({
        success: false,
        message: 'Song not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        playCount: updatedSong.playCount,
        sessionId: recentSession._id,
      },
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

/**
 * Upload audio file + Create song record (Combined endpoint)
 * Accepts file + metadata in ONE request
 */
export const uploadAudioFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get userId from protect middleware (already attached)
    const userId = req.user?.userId || req.user?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No audio file uploaded',
      });
      return;
    }

    // Upload to Cloudflare R2 with automatic conversion
    console.log('📤 Processing audio upload...');
    
    // Feature flag: Enable/disable automatic conversion
    const ENABLE_AUTO_CONVERSION = process.env.ENABLE_AUTO_CONVERSION !== 'false';
    
    let fileUrl: string;
    let originalUrl: string | undefined;
    let audioFormat: string | undefined;
    let audioBitrate: number | undefined;
    let audioFileSize: number | undefined;
    let originalFormat: string | undefined;
    let originalBitrate: number | undefined;
    let originalFileSize: number | undefined;
    
    if (ENABLE_AUTO_CONVERSION) {
      try {
        // Extract file format
        const ext = path.extname(req.file.originalname).slice(1).toLowerCase();
        originalFormat = ext;
        originalFileSize = req.file.size;
        
        console.log(`🎵 Original file: ${req.file.originalname} (${ext}, ${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // Check if conversion is needed
        const needsConversion = ext !== 'mp3';
        
        if (needsConversion) {
          console.log('🔄 Converting to MP3 320kbps...');
          
          // Convert to MP3
          const conversionResult = await AudioConverterService.convertBufferToMp3(
            req.file.buffer,
            ext
          );
          
          console.log(`✅ Conversion complete: ${(conversionResult.buffer.byteLength / 1024 / 1024).toFixed(2)}MB MP3`);
          
          // Generate temporary song ID (will be replaced with actual ID after song creation)
          const tempId = R2StorageManager.generateTempSongId();
          const timestamp = Date.now();
          
          // Upload MP3 (streaming version)
          fileUrl = await R2StorageManager.uploadStreaming(
            conversionResult.buffer,
            tempId,
            timestamp
          );
          
          // Upload original file (for downloads)
          originalUrl = await R2StorageManager.uploadOriginal(
            req.file.buffer,
            tempId,
            ext,
            req.file.mimetype,
            timestamp
          );
          
          // Set audio metadata from conversion
          audioFormat = 'mp3';
          audioBitrate = conversionResult.bitrate || 320;
          audioFileSize = conversionResult.buffer.byteLength;
          
          // Get original file metadata
          try {
            const originalMetadata = await AudioConverterService.getMetadataFromBuffer(
              req.file.buffer,
              ext
            );
            originalBitrate = originalMetadata.bitrate;
          } catch (metaError) {
            console.warn('⚠️ Could not extract original metadata:', metaError);
          }
          
          console.log('✅ Upload complete:');
          console.log(`   Streaming (MP3): ${fileUrl}`);
          console.log(`   Original (${ext.toUpperCase()}): ${originalUrl}`);
        } else {
          console.log('✅ Already MP3, uploading directly...');
          
          // Generate temporary song ID
          const tempId = R2StorageManager.generateTempSongId();
          const timestamp = Date.now();
          
          // Upload MP3 (streaming version)
          fileUrl = await R2StorageManager.uploadStreaming(
            req.file.buffer,
            tempId,
            timestamp
          );
          
          // Get MP3 metadata
          try {
            const metadata = await AudioConverterService.getMetadataFromBuffer(
              req.file.buffer,
              'mp3'
            );
            audioBitrate = metadata.bitrate;
          } catch (metaError) {
            console.warn('⚠️ Could not extract MP3 metadata:', metaError);
          }
          
          audioFormat = 'mp3';
          audioFileSize = req.file.size;
          
          console.log(`✅ Upload complete: ${fileUrl}`);
        }
      } catch (conversionError: any) {
        console.error('❌ Conversion/upload failed, falling back to legacy upload:', conversionError);
        
        // Fallback to legacy upload if conversion fails
        fileUrl = await LegacyUploadService.uploadAudioToR2(req.file);
        console.log('✅ Fallback upload successful:', fileUrl);
      }
    } else {
      // Feature disabled: Use legacy upload
      console.log('ℹ️ Auto-conversion disabled, using legacy upload');
      fileUrl = await LegacyUploadService.uploadAudioToR2(req.file);
    }
    
    console.log('✅ Audio file uploaded to R2:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl,
    });

    // Extract metadata from request body
    const { title, genre, price, description, exclusive, duration } = req.body;

    // If metadata is provided, create song record
    if (title) {
      console.log('📝 Creating song record with metadata:', { title, genre, price });
      
      // Beautiful gradient placeholder matching app theme (purple/pink gradient with music icon)
      const defaultCoverArt = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM5YzI3YjA7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOTFlYzc7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNnKSIvPjxnIG9wYWNpdHk9IjAuMyI+PHBhdGggZD0iTTE1MCw4MGMyNywwLDUwLDIyLDUwLDUwczAsNTAtNTAsNTBzLTUwLTIyLTUwLTUwUzEyMyw4MCwxNTAsODBaIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTE1MCwxMTBjMTEsMCwyMCw5LDIwLDIwczAsMjAtMjAsMjBzLTIwLTktMjAtMjBTMTM5LDExMCwxNTAsMTEwWiIgZmlsbD0iIzljMjdiMCIvPjxwYXRoIGQ9Ik0xNTAsMjAwYy0yNywwLTUwLTIyLTUwLTUwczIzLTUwLDUwLTUwczUwLDIyLDUwLDUwUzE3NywyMDAsMTUwLDIwMFptMC04MGMtMTEsMC0yMCw5LTIwLDIwczksyDAsMjAsMjAtOSwyMC0yMFMxNjEsMTM5LDE1MCwxMjBaIiBmaWxsPSIjZmZmIi8+PC9nPjwvc3ZnPg==';
      
      const song = await Song.create({
        artistId: userId,
        title,
        duration: parseInt(duration) || 240,
        price: parseInt(price) || 10,
        coverArt: defaultCoverArt,
        audioUrl: fileUrl,
        exclusive: exclusive === 'true' || exclusive === true,
        genre: genre || 'Pop',
        description: description || '',
        playCount: 0,
        featured: false,
        // Audio format metadata
        audioFormat,
        audioBitrate,
        audioFileSize,
        originalAudioUrl: originalUrl,
        originalFormat,
        originalBitrate,
        originalFileSize,
        // Download settings
        downloadEnabled: true,
        downloadCount: 0,
        downloadFormats: originalUrl ? ['mp3', originalFormat] : ['mp3'],
        premiumDownloadOnly: false,
      });

      console.log('✅ Song created in database:', song._id);

      res.status(201).json({
        success: true,
        message: 'Song uploaded and created successfully',
        data: { song },
      });
    } else {
      // If no metadata, just return file URL (legacy support)
      res.status(200).json({
        success: true,
        data: {
          url: fileUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    }
  } catch (error: any) {
    console.error('❌ Error uploading audio file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload audio file',
      error: error.message,
    });
  }
};

