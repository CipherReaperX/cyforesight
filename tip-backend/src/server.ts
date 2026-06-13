import 'dotenv/config';
import { startScheduler } from './services/scheduler.service';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/ratelimit.middleware';
import logger from './config/logger';
import { ensurePerformanceIndexes } from './config/indexes';
import db from './config/database';
import redis from './config/redis';
import { sql } from 'drizzle-orm';

const app = express();
const PORT = process.env.PORT || 9999;

// Security middleware
app.use(helmet());

// CORS setup with multiple allowed origins (ports 3000, 3001 and 4173)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser requests like curl, postman

    const isDevelopment = (process.env.NODE_ENV || 'development') !== 'production';
    let isDevLocalOrigin = false;
    try {
      const parsedOrigin = new URL(origin);
      isDevLocalOrigin =
        isDevelopment &&
        (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1');
    } catch {
      isDevLocalOrigin = false;
    }

    if (allowedOrigins.includes(origin) || isDevLocalOrigin) return callback(null, true);

    const msg = `CORS policy does not allow access from origin ${origin}`;
    return callback(new Error(msg), false);
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware — skip SSE streams (compression buffers chunked responses and breaks EventSource)
app.use(compression({
  filter: (req, res) => {
    if (res.getHeader('Content-Type') === 'text/event-stream') return false;
    if (req.path.endsWith('/stream')) return false;
    return compression.filter(req, res);
  },
}));

// Logging HTTP requests
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting on /api routes
app.use('/api', apiLimiter);

// API Routes
app.use('/api', routes);

// Health check endpoint could optionally be here as well
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health/ready', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    const redisReply = await redis.ping();
    res.status(200).json({
      status: 'ready',
      checks: {
        database: 'ok',
        redis: redisReply === 'PONG' ? 'ok' : 'degraded',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'not_ready',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 404 Not Found Handler for all other unknown endpoints
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  🛡️  CyForesight Backend Server Started                ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  📍 Server: http://localhost:${PORT}                   ║`);
  console.log(`║  🔌 API: http://localhost:${PORT}/api                  ║`);
  console.log(`║  ✅ Health: http://localhost:${PORT}/api/health        ║`);
  console.log(`║  🌍 Environment: ${process.env.NODE_ENV || 'development'} ║`);
  console.log('╚════════════════════════════════════════════════════════╝');
  
  logger.info(`CyForesight backend server started on port ${PORT}`);

  // Ensure commonly used query paths remain fast in large datasets.
  ensurePerformanceIndexes();
});

// Catch-all for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

// Catch-all for uncaught exceptions - exit after logging
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;

// Start scheduler for automatic background jobs
startScheduler();
