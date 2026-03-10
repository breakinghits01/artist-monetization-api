import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getMe,
  checkUsernameAvailability,
  checkEmailAvailability,
} from '../controllers/auth.controller';
import { protect, validate } from '../middleware/auth.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validator';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refreshAccessToken);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);

// Availability check routes (public)
router.get('/check-username/:username', checkUsernameAvailability);
router.get('/check-email/:email', checkEmailAvailability);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;
