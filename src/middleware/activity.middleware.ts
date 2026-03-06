import { Request, Response, NextFunction } from 'express';
import User from '../models/User.model';

/**
 * Activity Tracking Middleware
 * Updates user's lastActiveAt timestamp and online status on every authenticated request
 * 
 * Features:
 * - Updates lastActiveAt without blocking the request
 * - Marks user as online
 * - Tracks device type (mobile/web) from User-Agent
 * - Fire-and-forget pattern for optimal performance
 */
export const trackUserActivity = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (userId) {
      // Determine device type from User-Agent
      const userAgent = req.headers['user-agent']?.toLowerCase() || '';
      const deviceType = userAgent.includes('mobile') || 
                        userAgent.includes('android') || 
                        userAgent.includes('iphone') 
                        ? 'mobile' 
                        : 'web';
      
      // Fire-and-forget: Update activity without waiting
      // This ensures the middleware doesn't slow down API responses
      setImmediate(async () => {
        try {
          await User.findByIdAndUpdate(
            userId,
            {
              lastActiveAt: new Date(),
              isOnline: true,
              deviceType,
            },
            { 
              new: false, // Don't return the document (faster)
              runValidators: false, // Skip validation (we know data is valid)
            }
          );
        } catch (error) {
          // Silently log errors - don't affect user experience
          console.error('Activity tracking error:', error);
        }
      });
    }
    
    next();
  } catch (error) {
    // Never block the request due to activity tracking errors
    console.error('Activity middleware error:', error);
    next();
  }
};

/**
 * Online Status Calculator
 * User is considered online if active within last 5 minutes
 */
export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Calculate if user is online based on lastActiveAt
 */
export const isUserOnline = (lastActiveAt?: Date): boolean => {
  if (!lastActiveAt) return false;
  const now = Date.now();
  const lastActive = new Date(lastActiveAt).getTime();
  return (now - lastActive) < ONLINE_THRESHOLD_MS;
};

/**
 * Background job to update online status for all users
 * Should be run every 1 minute via cron/scheduler
 * 
 * Marks users as offline if lastActiveAt > 5 minutes ago
 */
export const updateAllUsersOnlineStatus = async (): Promise<void> => {
  try {
    const thresholdTime = new Date(Date.now() - ONLINE_THRESHOLD_MS);
    
    // Mark users as offline if they haven't been active
    await User.updateMany(
      {
        isOnline: true,
        lastActiveAt: { $lt: thresholdTime },
      },
      {
        isOnline: false,
      }
    );
    
    console.log('✅ Updated online status for inactive users');
  } catch (error) {
    console.error('❌ Error updating online status:', error);
  }
};
