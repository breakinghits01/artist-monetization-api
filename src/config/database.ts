import mongoose from 'mongoose';
import logger from './logger';

// Track reconnection attempts
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Enhanced connection options for production stability
    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 2, // Minimum number of connections to maintain
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      serverSelectionTimeoutMS: 5000, // How long to wait for server selection
      heartbeatFrequencyMS: 10000, // Check server health every 10 seconds
      retryWrites: true, // Automatically retry failed writes
      retryReads: true, // Automatically retry failed reads
      maxIdleTimeMS: 60000, // Close idle connections after 60 seconds
      waitQueueTimeoutMS: 5000, // Timeout when waiting for connection from pool
    });
    
    // Set default query timeout (15 seconds)
    mongoose.set('maxTimeMS', 15000);

    logger.info(`🍃 MongoDB Connected: ${conn.connection.host}`);
    logger.info(`📊 Database: ${conn.connection.name}`);
    logger.info(`🔌 Connection pool size: ${mongoose.connection.getClient().options?.maxPoolSize || 'default'}`);

    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;

    // Connection events for monitoring
    mongoose.connection.on('connected', () => {
      logger.info('✅ Mongoose connected to MongoDB');
      reconnectAttempts = 0;
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ Mongoose connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ Mongoose disconnected from MongoDB');
      
      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        logger.info(`🔄 Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
        
        setTimeout(() => {
          mongoose.connect(mongoUri).catch((err) => {
            logger.error('Reconnection attempt failed:', err.message);
          });
        }, delay);
      } else {
        logger.error('💥 Max reconnection attempts reached. Manual intervention required.');
      }
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('✅ Mongoose reconnected to MongoDB');
      reconnectAttempts = 0;
    });

    // Handle slow queries (queries taking more than 100ms)
    mongoose.set('debug', (collectionName, method, query, _doc) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`Mongoose: ${collectionName}.${method}`, JSON.stringify(query));
      }
    });

  } catch (error) {
    logger.error('❌ Error connecting to MongoDB:', error);
    
    // In production, retry instead of exiting
    if (process.env.NODE_ENV === 'production' && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      logger.info(`🔄 Retrying connection in ${delay}ms... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      
      setTimeout(() => {
        connectDB();
      }, delay);
    } else {
      process.exit(1);
    }
  }
};
