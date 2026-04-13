import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.middleware';
import { requireTier } from '../middleware/subscription.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  downloadSong,
  getAvailableFormats,
  getDownloadHistory,
  getSongDownloadStats,
  confirmDownload,
} from '../controllers/download.controller';

const router = express.Router();

/**
 * Per-user download rate limiter.
 *
 * Keyed by authenticated user ID — NOT by IP address.
 * Why this matters:
 *   - IP-based limits break offline sync for users behind shared NAT
 *     (mobile carrier NAT, shared WiFi, university networks, etc.)
 *   - One heavy downloader should never block other users on the same IP.
 *   - 500 downloads per 15 min is generous enough for a full library sync
 *     while still protecting against runaway clients / abuse.
 *
 * Applied AFTER `protect` so req.user is always populated when the key
 * generator runs. Falls back to IP only as a belt-and-suspenders safety net.
 */
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute rolling window
  max: 500,                  // 500 download requests per user per window
  standardHeaders: true,     // Return RateLimit-* headers so clients can back off gracefully
  legacyHeaders: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
  // Key by authenticated user ID — fully isolated per account regardless of IP
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return (
      authReq.user?.userId?.toString() ||
      authReq.user?._id?.toString()   ||
      req.ip                          ||
      'anonymous'
    );
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        'Download limit reached. You can download up to 500 songs every 15 minutes. ' +
        'Please wait a moment before continuing your offline sync.',
    });
  },
});

/**
 * Download Routes
 * All routes require authentication
 */

// Download a song in specified format
router.get('/song/:songId', protect, downloadLimiter, requireTier('premium'), downloadSong);

// Get available download formats for a song
router.get('/song/:songId/formats', protect, downloadLimiter, getAvailableFormats);

// Confirm download (track after user actually downloads)
router.post('/song/:songId/confirm', protect, downloadLimiter, confirmDownload);

// Get user's download history
router.get('/history', protect, getDownloadHistory);

// Get download statistics for a song (artist only)
router.get('/stats/:songId', protect, getSongDownloadStats);

export default router;
