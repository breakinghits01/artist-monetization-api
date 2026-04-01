import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  getPlans,
  getMySubscription,
  adminSetTier,
  adminListSubscriptions,
} from '../controllers/subscription.controller';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
/** GET /api/v1/subscription/plans  →  static plan definitions */
router.get('/plans', getPlans);

// ── Authenticated ─────────────────────────────────────────────────────────────
/** GET /api/v1/subscription/me  →  current user's subscription */
router.get('/me', protect, getMySubscription);

// ── Admin ─────────────────────────────────────────────────────────────────────
/** GET  /api/v1/subscription/admin/list          →  all users + tiers */
router.get('/admin/list', protect, adminListSubscriptions);
/** PATCH /api/v1/subscription/admin/:userId      →  set tier manually */
router.patch('/admin/:userId', protect, adminSetTier);

export default router;
