/**
 * Share Routes
 * Routes for song sharing functionality
 */

import express from 'express';
import {
  trackShare,
  getShareStats,
  getUserShares,
} from '../controllers/share.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Share routes
router.post('/songs/:songId/share', protect, trackShare);
router.get('/songs/:songId/shares/stats', getShareStats); // Public endpoint
router.get('/users/me/shares', protect, getUserShares);

export default router;
