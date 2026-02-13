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
import playlistRoutes from './routes/playlist.routes';
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

// Security Middleware - Relaxed CSP for Flutter Web
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://fonts.gstatic.com", "https://www.gstatic.com", "https://via.placeholder.com", "https://picsum.photos", "https://fastly.picsum.photos"],
      mediaSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
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
app.use(`/api/${API_VERSION}/playlists`, playlistRoutes);
// app.use(`/api/${API_VERSION}/tokens`, tokenRoutes);
// app.use(`/api/${API_VERSION}/treasure`, treasureRoutes);
// app.use(`/api/${API_VERSION}/analytics`, analyticsRoutes);

// Serve Flutter Web App static files
const flutterWebPath = path.join(process.cwd(), 'web-build');

// Static file serving for uploads - MUST be before Flutter static files
const uploadsPath = path.join(__dirname, '../uploads');
console.log('📁 Serving uploads from:', uploadsPath);
app.use('/uploads', (_req, res, next) => {
  // Set CORS headers for audio files
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsPath, {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp3') || filePath.endsWith('.m4a') || filePath.endsWith('.wav')) {
      res.set('Content-Type', 'audio/mpeg');
    }
  }
}));

// Serve Flutter web files for everything else (excluding /uploads and /api)
app.use((req, res, next) => {
  // Skip serving Flutter files for uploads and API routes
  if (req.path.startsWith('/uploads') || req.path.startsWith('/api/')) {
    return next();
  }
  express.static(flutterWebPath)(req, res, next);
});

// Catch-all route to serve Flutter's index.html for SPA routing
app.get('*', (req, res, next) => {
  // Skip API, health, and uploads routes
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
