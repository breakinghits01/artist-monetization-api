import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User.model';
import { TIER_DOWNLOAD_LIMITS, SubscriptionTier } from '../models/User.model';

/**
 * Static plan definitions — update pricing here, no redeploy needed
 * if you later move this to SystemSettings.
 */
const PLANS = [
  {
    id: 'free' as SubscriptionTier,
    name: 'Free',
    price: 0,
    currency: 'PHP',
    period: null,
    features: {
      streaming: true,
      downloads: false,
      downloadLimit: 0,
      exclusiveContent: false,
      audioQuality: 'Standard (128kbps)',
      adsEnabled: true,
      skipLimitPerHour: 6,
      earlyAccess: false,
    },
  },
  {
    id: 'premium' as SubscriptionTier,
    name: 'Premium',
    price: 199,
    currency: 'PHP',
    period: 'monthly',
    features: {
      streaming: true,
      downloads: true,
      downloadLimit: 100, // per month
      exclusiveContent: true,
      audioQuality: 'High (320kbps MP3)',
      adsEnabled: false,
      skipLimitPerHour: -1, // unlimited
      earlyAccess: false,
    },
  },
  {
    id: 'advanced' as SubscriptionTier,
    name: 'Advanced',
    price: 499,
    currency: 'PHP',
    period: 'monthly',
    features: {
      streaming: true,
      downloads: true,
      downloadLimit: -1, // unlimited
      exclusiveContent: true,
      audioQuality: 'Lossless (Original file)',
      adsEnabled: false,
      skipLimitPerHour: -1,
      earlyAccess: true,
    },
  },
];

/**
 * GET /api/v1/subscription/plans — Public
 * Returns static plan definitions with pricing and feature comparison.
 */
export const getPlans = (_req: AuthRequest, res: Response): void => {
  res.status(200).json({
    success: true,
    data: { plans: PLANS },
  });
};

/**
 * GET /api/v1/subscription/me — Auth required
 * Returns the authenticated user's current subscription.
 */
export const getMySubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select('subscription email username');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Safely default if subscription subdoc is missing (legacy users)
    const subscription = user.subscription ?? {
      tier: 'free',
      status: 'active',
      startDate: user.get('createdAt'),
      endDate: null,
      cancelledAt: null,
      downloadCount: 0,
      downloadLimit: 0,
    };

    res.status(200).json({
      success: true,
      data: { subscription },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription',
      error: error.message,
    });
  }
};

/**
 * PATCH /api/v1/admin/subscriptions/:userId — Admin only
 * Manually set a user's subscription tier (for beta/gifting/testing).
 */
export const adminSetTier = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { tier, endDate } = req.body as {
      tier: SubscriptionTier;
      endDate?: string;
    };

    const validTiers: SubscriptionTier[] = ['free', 'premium', 'advanced'];
    if (!validTiers.includes(tier)) {
      res.status(400).json({
        success: false,
        message: `Invalid tier. Must be one of: ${validTiers.join(', ')}`,
      });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'subscription.tier': tier,
          'subscription.status': 'active',
          'subscription.startDate': new Date(),
          'subscription.endDate': endDate ? new Date(endDate) : null,
          'subscription.downloadLimit': TIER_DOWNLOAD_LIMITS[tier],
          'subscription.downloadCount': 0,
        },
      },
      { new: true, select: 'email username subscription' }
    );

    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Subscription updated to ${tier}`,
      data: { user: updatedUser },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription',
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/subscriptions — Admin only
 * List all users with their subscription tier (paginated).
 */
export const adminListSubscriptions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 50, tier } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 200);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, any> = {};
    if (tier) query['subscription.tier'] = tier;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('email username role subscription createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          total,
          limit: limitNum,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to list subscriptions',
      error: error.message,
    });
  }
};
