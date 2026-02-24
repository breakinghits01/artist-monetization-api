/**
 * Comment Routes
 * Routes for song comments functionality
 */

import express from 'express';
import {
  createComment,
  getComments,
  replyToComment,
  getReplies,
  editComment,
  deleteComment,
  likeComment,
} from '../controllers/comment.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Song comment routes
router.post('/songs/:songId/comments', protect, createComment);
router.get('/songs/:songId/comments', getComments); // Public endpoint

// Comment-specific routes
router.post('/comments/:commentId/reply', protect, replyToComment);
router.get('/comments/:commentId/replies', getReplies); // Public endpoint
router.patch('/comments/:commentId', protect, editComment);
router.delete('/comments/:commentId', protect, deleteComment);
router.post('/comments/:commentId/like', protect, likeComment);

export default router;
