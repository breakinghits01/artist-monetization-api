import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { protect, optionalAuth } from '../middleware/auth.middleware';
import User from '../models/User.model';

const router = Router();
const userController = new UserController();

// Public routes (with optional auth to exclude current user)
router.get('/discover', optionalAuth, (req, res) => userController.discoverArtists(req, res));
router.get('/profile/:userId', (req, res) => userController.getProfile(req, res));

// Protected routes
router.get('/me', protect, (req, res) => userController.getCurrentUser(req, res));
router.patch('/me', protect, (req, res) => userController.updateProfile(req, res));

// Activity tracking routes
router.post('/heartbeat', protect, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { sessionId } = req.body;
    
    // Determine device type
    const userAgent = req.headers['user-agent']?.toLowerCase() || '';
    const deviceType = userAgent.includes('mobile') || 
                      userAgent.includes('android') || 
                      userAgent.includes('iphone') 
                      ? 'mobile' 
                      : 'web';
    
    await User.findByIdAndUpdate(
      userId,
      {
        lastActiveAt: new Date(),
        isOnline: true,
        deviceType,
        ...(sessionId && { sessionId }),
      },
      { new: false }
    );
    
    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        isOnline: true,
      },
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update heartbeat',
    });
  }
});

router.get('/status', protect, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    
    const user = await User.findById(userId).select('lastActiveAt isOnline deviceType');
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        isOnline: user.isOnline,
        lastActiveAt: user.lastActiveAt,
        deviceType: user.deviceType,
      },
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get status',
    });
  }
});

export default router;
