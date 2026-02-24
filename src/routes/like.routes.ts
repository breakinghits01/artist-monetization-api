/**
 * Like Routes
 * Routes for song like/dislike functionality
 */

import express from 'express';
import {
  toggleLike,
  toggleDislike,
  removeReaction,
  getUserReaction,
  getSongStats,
} from '../controllers/like.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Song engagement routes
router.post('/songs/:songId/like', protect, toggleLike);
router.post('/songs/:songId/dislike', protect, toggleDislike);
router.delete('/songs/:songId/reaction', protect, removeReaction);
router.get('/songs/:songId/reaction', protect, getUserReaction);
router.get('/songs/:songId/stats', getSongStats); // Public endpoint

export default router;
