import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

interface ErrorResponse {
  success: false;
  message: string;
  stack?: string;
  errors?: any;
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const error = err as AppError;
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Log error
  logger.error(`Error ${statusCode}: ${message}`);
  if (process.env.NODE_ENV === 'development') {
    logger.error(error.stack);
  }

  // Send response
  const response: ErrorResponse = {
    success: false,
    message,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};
