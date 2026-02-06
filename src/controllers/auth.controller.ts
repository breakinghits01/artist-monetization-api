import { Request, Response } from 'express';
import User from '../models/User.model';
import {
  generateTokenPair,
  generateResetToken,
  generateVerificationToken,
  hashToken,
  verifyRefreshToken,
} from '../utils/token.utils';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';

/**
 * @desc    Register new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password, username, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('User already exists with this email', 409);
    }

    // Check if username is taken
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        throw new AppError('Username is already taken', 409);
      }
    }

    // Generate email verification token
    const { verificationToken, hashedToken } = generateVerificationToken();
    const verificationExpire = new Date(
      Date.now() + parseInt(process.env.EMAIL_VERIFICATION_EXPIRE || '24') * 60 * 60 * 1000
    );

    // Create user with all fields
    const user = await User.create({
      email,
      password,
      username,
      role: role || 'fan',
      emailVerificationToken: hashedToken,
      emailVerificationExpire: verificationExpire,
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(
      user._id.toString(),
      user.email,
      user.role
    );

    // Store refresh token (hashed)
    user.refreshToken = hashToken(refreshToken);
    user.refreshTokenExpire = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    );
    await user.save();

    // TODO: Send verification email
    logger.info(`Verification token for ${email}: ${verificationToken}`);
    logger.info(`Verification link: ${process.env.FRONTEND_URL}/verify-email/${verificationToken}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user,
        accessToken,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Registration error:', error.message || error);
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? error.message : 'Server error during registration',
      });
    }
  }
};

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      const lockDuration = Math.ceil(
        ((user.lockUntil?.getTime() || 0) - Date.now()) / 60000
      );
      throw new AppError(
        `Account is locked. Please try again in ${lockDuration} minutes.`,
        423
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incrementLoginAttempts();
      throw new AppError('Invalid credentials', 401);
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(
      user._id.toString(),
      user.email,
      user.role
    );

    // Store refresh token (hashed)
    user.refreshToken = hashToken(refreshToken);
    user.refreshTokenExpire = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    );
    await user.save();

    // Remove password from response
    const userResponse = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        accessToken,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login',
      });
    }
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Clear refresh token from database
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { refreshToken: 1, refreshTokenExpire: 1 },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
    });
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh
 * @access  Public (requires refresh token in body)
 */
export const refreshAccessToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user and check stored refresh token
    const user = await User.findById(decoded.userId).select('+refreshToken +refreshTokenExpire');
    if (!user) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Check if refresh token matches and is not expired
    const hashedProvidedToken = hashToken(refreshToken);
    if (
      user.refreshToken !== hashedProvidedToken ||
      !user.refreshTokenExpire ||
      user.refreshTokenExpire < new Date()
    ) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Generate new access token
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(
      user._id.toString(),
      user.email,
      user.role
    );

    // Optionally rotate refresh token (recommended for security)
    user.refreshToken = hashToken(newRefreshToken);
    user.refreshTokenExpire = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }
  }
};

/**
 * @desc    Forgot password - Send reset email
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });

    // Always return same response (security - don't reveal if email exists)
    const response = {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    };

    if (!user) {
      res.status(200).json(response);
      return;
    }

    // Generate reset token
    const { resetToken, hashedToken } = generateResetToken();
    const resetExpire = new Date(
      Date.now() + parseInt(process.env.RESET_PASSWORD_EXPIRE || '15') * 60 * 1000
    );

    // Save hashed token to database
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = resetExpire;
    await user.save();

    // TODO: Send reset email
    logger.info(`Reset token for ${email}: ${resetToken}`);
    logger.info(`Reset link: ${process.env.FRONTEND_URL}/reset-password/${resetToken}`);

    res.status(200).json(response);
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing request',
    });
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, password } = req.body;

    // Hash the provided token to compare with stored hash
    const hashedToken = hashToken(token);

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    // Invalidate all existing refresh tokens (force re-login)
    user.refreshToken = undefined;
    user.refreshTokenExpire = undefined;
    
    await user.save();

    // TODO: Send password changed confirmation email
    logger.info(`Password reset successful for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error resetting password',
      });
    }
  }
};

/**
 * @desc    Verify email address
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.body;

    // Hash the provided token to compare with stored hash
    const hashedToken = hashToken(token);

    // Find user with valid verification token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpire');

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    // Mark email as verified
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    logger.info(`Email verified for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error verifying email',
      });
    }
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getMe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    logger.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user',
    });
  }
};
