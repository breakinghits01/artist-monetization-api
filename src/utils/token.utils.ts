import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

interface RefreshTokenPayload {
  userId: string;
}

/**
 * Generate JWT access token.
 * A random `jti` (JWT ID) is included so that two tokens generated in the
 * same second for the same user are never byte-for-byte identical.
 */
export const generateAccessToken = (
  userId: string,
  email: string,
  role: string
): string => {
  const payload: TokenPayload = { userId, email, role };
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRE || '90d',
    jwtid: crypto.randomBytes(16).toString('hex'), // unique per token
  } as jwt.SignOptions);
};

/**
 * Generate JWT refresh token.
 * A random `jti` ensures every rotation issues a truly new token even when
 * the call happens within the same clock second as the previous one.
 */
export const generateRefreshToken = (userId: string): string => {
  const payload: RefreshTokenPayload = { userId };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
    jwtid: crypto.randomBytes(16).toString('hex'), // unique per token
  } as jwt.SignOptions);
};

/**
 * Verify access token and return decoded payload
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

/**
 * Verify refresh token and return decoded payload
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as RefreshTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

/**
 * Generate password reset token
 * Returns both plain token (to send to user) and hashed token (to store in DB)
 */
export const generateResetToken = (): {
  resetToken: string;
  hashedToken: string;
} => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  return { resetToken, hashedToken };
};

/**
 * Generate email verification token
 * Returns both plain token (to send to user) and hashed token (to store in DB)
 */
export const generateVerificationToken = (): {
  verificationToken: string;
  hashedToken: string;
} => {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  return { verificationToken, hashedToken };
};

/**
 * Hash a token using SHA256 (for comparing with stored hashed tokens)
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (
  userId: string,
  email: string,
  role: string
): {
  accessToken: string;
  refreshToken: string;
} => {
  const accessToken = generateAccessToken(userId, email, role);
  const refreshToken = generateRefreshToken(userId);
  
  return { accessToken, refreshToken };
};
