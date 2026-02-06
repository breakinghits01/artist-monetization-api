import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import songRoutes from './routes/song.routes';
import bundleRoutes from './routes/bundle.routes';
import ratingRoutes from './routes/rating.routes';
import tipRoutes from './routes/tip.routes';
import notificationRoutes from './routes/notification.routes';
import followRoutes from './routes/follow.routes';
import activityRoutes from './routes/activity.routes';
// import tokenRoutes from './routes/token.routes';
// import treasureRoutes from './routes/treasure.routes';
// import analyticsRoutes from './routes/analytics.routes';


// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Import config
import { connectDB } from './config/database';
import logger from './config/logger';

const app: Application = express();
const PORT = Number(process.env.PORT) || 3000;

// Connect to MongoDB
connectDB();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    process.env.WEB_FRONTEND_URL || 'http://localhost:3001',
    'https://caryl-exertive-treva.ngrok-free.dev', // ngrok permanent URL
    /\.ngrok-free\.dev$/, // Allow any ngrok domain
    /\.ngrok\.io$/ // Allow custom ngrok subdomains
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Compression middleware
app.use(compression());

// HTTP request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint (keep before static files for API access)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes (all under /api prefix)
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/songs`, songRoutes);
app.use(`/api/${API_VERSION}/bundles`, bundleRoutes);
app.use(`/api/${API_VERSION}/ratings`, ratingRoutes);
app.use(`/api/${API_VERSION}/tips`, tipRoutes);
app.use(`/api/${API_VERSION}/notifications`, notificationRoutes);
app.use(`/api/${API_VERSION}/follow`, followRoutes);
app.use(`/api/${API_VERSION}/activity`, activityRoutes);
// app.use(`/api/${API_VERSION}/tokens`, tokenRoutes);
// app.use(`/api/${API_VERSION}/treasure`, treasureRoutes);
// app.use(`/api/${API_VERSION}/analytics`, analyticsRoutes);

// Static file serving for uploads (development only)
if (process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static(process.env.UPLOAD_PATH || './uploads'));
}

// Serve Flutter Web App static files
const flutterWebPath = path.join(process.cwd(), 'web-build');
app.use(express.static(flutterWebPath));

// Catch-all route to serve Flutter's index.html for SPA routing
app.get('*', (req, res, next) => {
  // Skip API and health routes
  if (req.path.startsWith('/api/') || req.path === '/health' || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(flutterWebPath, 'index.html'));
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server - listen on all interfaces (0.0.0.0) to accept connections from mobile devices
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  logger.info(`📡 API available at http://localhost:${PORT}/api/${API_VERSION}`);
  logger.info(`📱 Mobile access at http://192.168.100.32:${PORT}/api/${API_VERSION}`);
  logger.info(`🏥 Health check at http://localhost:${PORT}/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    logger.info('💥 Process terminated!');
  });
});

export default app;
