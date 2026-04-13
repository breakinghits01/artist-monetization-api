import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';

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
import downloadRoutes from './routes/download.routes';
import likeRoutes from './routes/like.routes';
import commentRoutes from './routes/comment.routes';
import shareRoutes from './routes/share.routes';
import adminRoutes from './routes/admin.routes';
import settingsRoutes from './routes/settings.routes';
import subscriptionRoutes from './routes/subscription.routes';
// import tokenRoutes from './routes/token.routes';
// import treasureRoutes from './routes/treasure.routes';
// import analyticsRoutes from './routes/analytics.routes';


// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { updateAllUsersOnlineStatus } from './middleware/activity.middleware';

// Import config
import { connectDB } from './config/database';
import logger from './config/logger';
import { initializeWebSocket } from './services/socket.service';

const app: Application = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable trust proxy for Cloudflare/reverse proxy setup
app.set('trust proxy', true);

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

// Rate limiting - More generous limits for production stability
// Separate rate limiters for different endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 for better UX
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false, // Disable trust proxy validation to prevent crashes
    xForwardedForHeader: false,
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;
    // Skip download routes — they have their own per-user limiter in download.routes.ts.
    // Counting downloads here (IP-based) would unfairly block offline sync for users
    // behind shared IPs (mobile carrier NAT, shared WiFi, etc.).
    if (req.path.includes('/download/')) return true;
    return false;
  },
  handler: (_req, res) => {
    logger.warn('Rate limit exceeded');
    res.status(429).json({
      status: 'error',
      message: 'Too many requests, please slow down and try again later.'
    });
  }
});

// Stricter rate limit for auth endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful requests
  validate: {
    trustProxy: false, // Disable trust proxy validation to prevent crashes
    xForwardedForHeader: false,
  },
  handler: (_req, res) => {
    logger.warn('Auth rate limit exceeded');
    res.status(429).json({
      status: 'error',
      message: 'Too many authentication attempts, please try again later.'
    });
  }
});

app.use('/api', apiLimiter);
app.use('/api/*/auth', authLimiter);

// Request timeout middleware
// Upload route gets 5 minutes; everything else gets 30 seconds
app.use((req, res, next) => {
  const isUpload = req.method === 'POST' && req.path.includes('/songs/upload');
  const timeoutMs = isUpload ? 5 * 60 * 1000 : 30000;

  req.setTimeout(timeoutMs, () => {
    logger.warn(`Request timeout: ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Request timeout. Please try again.'
      });
    }
  });
  
  res.setTimeout(timeoutMs, () => {
    logger.warn(`Response timeout: ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        message: 'Gateway timeout. Please try again.'
      });
    }
  });
  
  next();
});

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

// Health check endpoint with detailed monitoring
app.get('/health', async (_req, res) => {
  try {
    // Check MongoDB connection
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Get memory usage
    const memUsage = process.memoryUsage();
    const memoryMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };

    // Get uptime
    const uptime = process.uptime();
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uptime: uptimeStr,
      database: dbStatus,
      memory: memoryMB,
      nodejs: process.version,
      pid: process.pid
    };

    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service temporarily unavailable'
    });
  }
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
app.use(`/api/${API_VERSION}/download`, downloadRoutes);
app.use(`/api/${API_VERSION}/subscription`, subscriptionRoutes);
app.use(`/api/${API_VERSION}`, likeRoutes);
app.use(`/api/${API_VERSION}`, commentRoutes);
app.use(`/api/${API_VERSION}`, shareRoutes);
app.use(`/api/${API_VERSION}`, adminRoutes);
app.use(`/api/${API_VERSION}/admin/settings`, settingsRoutes);
// app.use(`/api/${API_VERSION}/tokens`, tokenRoutes);
// app.use(`/api/${API_VERSION}/treasure`, treasureRoutes);
// app.use(`/api/${API_VERSION}/analytics`, analyticsRoutes);

// Serve Flutter Web App static files
const flutterWebPath = path.join(process.cwd(), 'web-build');

// NOTE: Audio files are now served from Cloudflare R2
// No longer serving local uploads directory
// Old route kept for backward compatibility (legacy songs)
const uploadsPath = path.join(__dirname, '../uploads');
console.log('📁 Legacy uploads fallback from:', uploadsPath);
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

// Create HTTP server (required for Socket.IO)
const httpServer = createServer(app);

// Initialize WebSocket
const io = initializeWebSocket(httpServer);

// Make io available globally for other modules
(global as any).io = io;

// Start server - listen on all interfaces (0.0.0.0) to accept connections from mobile devices
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  logger.info(`📡 API available at http://localhost:${PORT}/api/${API_VERSION}`);
  logger.info(`📱 Mobile access at http://192.168.100.32:${PORT}/api/${API_VERSION}`);
  logger.info(`🏥 Health check at http://localhost:${PORT}/health`);
  logger.info(`🌐 WebSocket server running on port ${PORT}`);
  
  // Start online status update job (runs every 1 minute)
  setInterval(async () => {
    await updateAllUsersOnlineStatus();
  }, 60 * 1000); // 60 seconds
  
  logger.info('⏱️  Online status update job started (runs every 1 minute)');
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connections
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      logger.info('Database connections closed');
      
      // Close WebSocket connections
      if (io) {
        io.close();
        logger.info('WebSocket connections closed');
      }
      
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error, promise: Promise<any>) => {
  logger.error('UNHANDLED REJECTION! 💥');
  logger.error('Error name:', err.name);
  logger.error('Error message:', err.message);
  logger.error('Error stack:', err.stack);
  logger.error('Promise:', promise);
  
  // In production, log but don't crash - maintain uptime
  if (process.env.NODE_ENV === 'production') {
    logger.warn('⚠️ Continuing operation in production mode (error logged)');
    
    // Track rejection for monitoring
    if ((global as any).rejectionCount === undefined) {
      (global as any).rejectionCount = 0;
    }
    (global as any).rejectionCount++;
    
    // If too many rejections in short time, restart gracefully
    if ((global as any).rejectionCount > 10) {
      logger.error('Too many unhandled rejections. Initiating graceful restart...');
      gracefulShutdown('MULTIPLE UNHANDLED REJECTIONS');
    }
    
    // Reset counter after 5 minutes
    setTimeout(() => {
      (global as any).rejectionCount = 0;
    }, 5 * 60 * 1000);
  } else {
    gracefulShutdown('UNHANDLED REJECTION');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error('Error name:', err.name);
  logger.error('Error message:', err.message);
  logger.error('Error stack:', err.stack);
  gracefulShutdown('UNCAUGHT EXCEPTION');
});

// Handle SIGTERM (e.g., from PM2 restart)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT (e.g., Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Memory monitoring and cleanup
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    // Warn if memory usage is high (>80% of heap)
    if (heapUsedMB / heapTotalMB > 0.8) {
      logger.warn(`High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection');
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

export default app;
