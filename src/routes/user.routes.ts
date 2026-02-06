import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { protect, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

// Public routes (with optional auth to exclude current user)
router.get('/discover', optionalAuth, (req, res) => userController.discoverArtists(req, res));
router.get('/profile/:userId', (req, res) => userController.getProfile(req, res));

// Protected routes
router.get('/me', protect, (req, res) => userController.getCurrentUser(req, res));
router.patch('/me', protect, (req, res) => userController.updateProfile(req, res));

export default router;
