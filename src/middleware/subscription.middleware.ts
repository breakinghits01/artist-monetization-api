import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { TIER_RANK, SubscriptionTier } from '../models/User.model';

/**
 * Subscription tier gate middleware.
 * Must be placed AFTER `protect` (which attaches req.user).
 *
 * Usage:
 *   router.get('/song/:id', protect, requireTier('premium'), downloadSong);
 *
 * Returns 403 + { upgradeTo } so the client can show the upgrade modal.
 */
export const requireTier = (minTier: 'premium' | 'advanced') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Existing users without subscription field default to 'free'
    const tier = (req.user?.subscription?.tier || 'free') as SubscriptionTier;

    if (TIER_RANK[tier] >= TIER_RANK[minTier]) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: `This feature requires a ${minTier} subscription. Upgrade to unlock offline downloads.`,
      upgradeTo: minTier,
    });
  };
};
