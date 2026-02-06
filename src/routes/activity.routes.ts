import { Router } from 'express';
import { activityController } from '../controllers/activity.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All activity routes require authentication

// Get activity feed (from followed artists)
router.get('/feed', protect, (req, res) => activityController.getActivityFeed(req, res));

// Get user's own activities
router.get('/user/:userId', (req, res) => activityController.getUserActivities(req, res));

// Delete activity
router.delete('/:activityId', protect, (req, res) => activityController.deleteActivity(req, res));

export default router;
