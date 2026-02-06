import { Router } from 'express';
import { FollowController } from '../controllers/follow.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
const followController = new FollowController();

// All follow routes require authentication

// Follow/Unfollow
router.post('/:artistId', protect, (req, res) => followController.followArtist(req, res));
router.delete('/:artistId', protect, (req, res) => followController.unfollowArtist(req, res));

// Get followers/following lists (public)
router.get('/followers/:userId', (req, res) => followController.getFollowers(req, res));
router.get('/following/:userId', (req, res) => followController.getFollowing(req, res));

// Check follow status (requires auth)
router.get('/status/:artistId', protect, (req, res) => followController.checkFollowStatus(req, res));

// Get follow stats (public)
router.get('/stats/:userId', (req, res) => followController.getFollowStats(req, res));

export default router;
