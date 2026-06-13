import 'dotenv/config';
import http from 'http';
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
import { initSocketIO, shutdownSocketIO } from './services/socket.service';

const app = express();
const PORT = process.env.PORT || 9999;

// Security middleware
app.use(helmet());

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://localhost:4173')
  .split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isDev = (process.env.NODE_ENV || 'development') !== 'production';
    let isLocal = false;
    try {
      const u = new URL(origin);
      isLocal = isDev && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    } catch { /* ignore */ }
    if (allowedOrigins.includes(origin) || isLocal) return callback(null, true);
    return callback(new Error(`CORS policy blocks origin ${origin}`), false);
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression — skip SSE streams
app.use(compression({
  filter: (req, res) => {
    if (res.getHeader('Content-Type') === 'text/event-stream') return false;
    if (req.path.endsWith('/stream')) return false;
    return compression.filter(req, res);
  },
}));

// HTTP request logging
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting
app.use('/api', apiLimiter);

// API routes
app.use('/api', routes);

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health/ready', async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    const pong = await redis.ping();
    res.json({ status: 'ready', checks: { database: 'ok', redis: pong === 'PONG' ? 'ok' : 'degraded' }, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: 'not_ready', message: err.message, timestamp: new Date().toISOString() });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

// Create HTTP server and attach Socket.IO
const httpServer = http.createServer(app);
initSocketIO(httpServer);

httpServer.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  🛡️  CyForesight Backend Server Started                ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  📍 Server: http://localhost:${PORT}                   ║`);
  console.log(`║  🔌 API:    http://localhost:${PORT}/api               ║`);
  console.log(`║  🔴 WS:     ws://localhost:${PORT} (Socket.IO)         ║`);
  console.log(`║  ✅ Health: http://localhost:${PORT}/api/health        ║`);
  console.log(`║  🌍 Env:    ${process.env.NODE_ENV || 'development'}              ║`);
  console.log('╚════════════════════════════════════════════════════════╝');

  logger.info(`CyForesight backend started on port ${PORT}`);
  ensurePerformanceIndexes();
});

process.on('SIGTERM', () => { shutdownSocketIO(); httpServer.close(); });
process.on('SIGINT',  () => { shutdownSocketIO(); httpServer.close(); });

process.on('unhandledRejection', (reason) => { logger.error('Unhandled Rejection:', reason); });
process.on('uncaughtException',  (error) =>  { logger.error('Uncaught Exception:', error); process.exit(1); });

export default app;

startScheduler();
