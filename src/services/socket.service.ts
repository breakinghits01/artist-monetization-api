import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';

// Store active socket connections by userId
const userSockets = new Map<string, Socket>();

/**
 * Initialize Socket.IO server
 */
export const initializeWebSocket = (server: HTTPServer): SocketIOServer => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Configure properly in production
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use((socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth.token;
      const userId = socket.handshake.auth.userId;

      if (!token || !userId) {
        logger.warn('WebSocket connection rejected: Missing credentials');
        return next(new Error('Authentication error: Missing credentials'));
      }

      // Verify JWT token
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      if (decoded.userId !== userId) {
        logger.warn('WebSocket connection rejected: User ID mismatch');
        return next(new Error('Authentication error: User ID mismatch'));
      }

      // Attach user info to socket
      socket.data.userId = userId;
      socket.data.user = decoded;

      logger.info(`✅ WebSocket authenticated: ${userId}`);
      next();
    } catch (error: any) {
      logger.error('WebSocket authentication failed:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`🔌 WebSocket connected: ${userId} (${socket.id})`);

    // Store socket connection
    userSockets.set(userId, socket);

    // Join user's personal room
    socket.join(`user_${userId}`);
    logger.info(`📥 User joined room: user_${userId}`);

    // Handle join event (explicit join)
    socket.on('join', (data: { userId: string }) => {
      try {
        if (data.userId === userId) {
          socket.join(`user_${data.userId}`);
          logger.info(`📥 User explicitly joined room: user_${data.userId}`);
        }
      } catch (error) {
        logger.error(`Error joining room for ${userId}:`, error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      logger.info(`🔌 WebSocket disconnected: ${userId} (${socket.id}) - Reason: ${reason}`);
      userSockets.delete(userId);
    });

    // Handle errors with recovery
    socket.on('error', (error: Error) => {
      logger.error(`❌ WebSocket error for ${userId}:`, error);
      
      // Attempt to recover by cleaning up and allowing reconnection
      try {
        userSockets.delete(userId);
        socket.disconnect(true);
      } catch (cleanupError) {
        logger.error(`Error during socket cleanup for ${userId}:`, cleanupError);
      }
    });

    // Handle connection errors
    socket.on('connect_error', (error: Error) => {
      logger.error(`❌ WebSocket connection error for ${userId}:`, error);
    });

    // Handle timeout
    socket.on('timeout', () => {
      logger.warn(`⏱️ WebSocket timeout for ${userId}`);
    });

    // Send connection success message
    socket.emit('connected', {
      message: 'WebSocket connected successfully',
      userId,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle server-level errors
  io.engine.on('connection_error', (err: any) => {
    logger.error('WebSocket server connection error:', {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  logger.info('✅ WebSocket server initialized');
  return io;
};

/**
 * Emit notification to specific user
 */
export const emitNotificationToUser = (
  io: SocketIOServer,
  userId: string,
  event: string,
  data: any
): void => {
  try {
    io.to(`user_${userId}`).emit(event, data);
    logger.info(`📤 Emitted ${event} to user_${userId}`);
  } catch (error) {
    logger.error(`Failed to emit ${event} to user_${userId}:`, error);
  }
};

/**
 * Check if user is connected
 */
export const isUserConnected = (userId: string): boolean => {
  return userSockets.has(userId);
};

/**
 * Get socket for user
 */
export const getUserSocket = (userId: string): Socket | undefined => {
  return userSockets.get(userId);
};

/**
 * Broadcast to all connected users
 */
export const broadcastToAll = (io: SocketIOServer, event: string, data: any): void => {
  try {
    io.emit(event, data);
    logger.info(`📡 Broadcast ${event} to all users`);
  } catch (error) {
    logger.error(`Failed to broadcast ${event}:`, error);
  }
};

export default {
  initializeWebSocket,
  emitNotificationToUser,
  isUserConnected,
  getUserSocket,
  broadcastToAll,
};
