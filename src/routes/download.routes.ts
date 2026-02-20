import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  downloadSong,
  getAvailableFormats,
  getDownloadHistory,
  getSongDownloadStats,
  confirmDownload,
} from '../controllers/download.controller';

const router = express.Router();

/**
 * Download Routes
 * All routes require authentication
 */

// Download a song in specified format
router.get('/song/:songId', protect, downloadSong);

// Get available download formats for a song
router.get('/song/:songId/formats', protect, getAvailableFormats);

// Confirm download (track after user actually downloads)
router.post('/song/:songId/confirm', protect, confirmDownload);

// Get user's download history
router.get('/history', protect, getDownloadHistory);

// Get download statistics for a song (artist only)
router.get('/stats/:songId', protect, getSongDownloadStats);

export default router;
