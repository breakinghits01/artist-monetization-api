import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.utils';
import User from '../models/User.model';
import { AppError } from './errorHandler';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Export AuthRequest type for use in controllers
export interface AuthRequest extends Request {
  user?: any;
}

/**
 * Authentication middleware - Protect routes
 * Verifies JWT token and attaches user to request
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Extract token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      throw new AppError('Not authorized. Please login.', 401);
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError('User no longer exists', 401);
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      throw new AppError(
        'Account is locked due to multiple failed login attempts. Please try again later.',
        423
      );
    }

    // Attach user to request
    req.user = user;
    
    // Track user activity (fire-and-forget for performance)
    setImmediate(async () => {
      try {
        const userAgent = req.headers['user-agent']?.toLowerCase() || '';
        const deviceType = userAgent.includes('mobile') || 
                          userAgent.includes('android') || 
                          userAgent.includes('iphone') 
                          ? 'mobile' 
                          : 'web';
        
        await User.findByIdAndUpdate(
          user._id,
          {
            lastActiveAt: new Date(),
            isOnline: true,
            deviceType,
          },
          { 
            new: false,
            runValidators: false,
          }
        );
      } catch (error) {
        // Silently log - don't affect user experience
        console.error('Activity tracking error:', error);
      }
    });
    
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role(s)
 * @param roles - Array of allowed roles
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource`,
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Tries to authenticate but doesn't fail if no token
 * Useful for endpoints that work for both authenticated and non-authenticated users
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      
      if (user && !user.isAccountLocked()) {
        req.user = user;
      }
    }
  } catch (_error) {
    // Silently fail - user remains undefined
  }

  next();
};

/**
 * Email verification required middleware
 * Checks if user's email is verified
 */
export const requireVerified = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
    return;
  }

  if (!req.user.isVerified) {
    res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this resource',
    });
    return;
  }

  next();
};

/**
 * Validation middleware wrapper
 * Validates request body against Joi schema
 */
export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
      return;
    }

    // Replace request body with validated and sanitized value
    req.body = value;
    next();
  };
};
