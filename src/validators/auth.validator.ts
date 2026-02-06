import Joi from 'joi';

/**
 * Password validation regex
 * Requires: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Registration validation schema
 */
export const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  
  password: Joi.string()
    .min(8)
    .pattern(passwordRegex)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      'any.required': 'Password is required',
    }),
  
  username: Joi.string()
    .min(3)
    .max(30)
    .alphanum()
    .trim()
    .messages({
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username cannot exceed 30 characters',
      'string.alphanum': 'Username must only contain alphanumeric characters',
    }),
  
  role: Joi.string()
    .valid('artist', 'fan')
    .default('fan')
    .messages({
      'any.only': 'Role must be either "artist" or "fan"',
    }),
});

/**
 * Login validation schema
 */
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

/**
 * Forgot password validation schema
 */
export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
});

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Reset token is required',
    }),
  
  password: Joi.string()
    .min(8)
    .pattern(passwordRegex)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      'any.required': 'Password is required',
    }),
});

/**
 * Verify email validation schema
 */
export const verifyEmailSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Verification token is required',
    }),
});

/**
 * Update profile validation schema
 */
export const updateProfileSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(30)
    .alphanum()
    .trim()
    .messages({
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username cannot exceed 30 characters',
      'string.alphanum': 'Username must only contain alphanumeric characters',
    }),
  
  bio: Joi.string()
    .max(500)
    .trim()
    .allow('')
    .messages({
      'string.max': 'Bio cannot exceed 500 characters',
    }),
});
