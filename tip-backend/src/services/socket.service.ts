import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';
import dashboardService from './dashboard.service';

export type SocketEvent =
  | 'dashboard:pulse'
  | 'dashboard:refresh'
  | 'ioc:new'
  | 'feed:synced'
  | 'feed:error'
  | 'notification:new'
  | 'integration:update'
  | 'integration:tested'
  | 'incident:created'
  | 'incident:updated'
  | 'incident:deleted';

// ─── In-memory notification ring buffer ──────────────────────────────────────

export type NotificationType = 'feed_sync' | 'feed_error' | 'ioc_spike' | 'system';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  read: boolean;
  ts: string;
};

const MAX_NOTIFICATIONS = 100;
let notificationBuffer: Notification[] = [];
let notificationSeq = 0;

export function addNotification(
  type: NotificationType,
  title: string,
  body: string,
  meta?: Record<string, unknown>
): Notification {
  const n: Notification = {
    id: `n-${Date.now()}-${++notificationSeq}`,
    type,
    title,
    body,
    meta: meta ?? {},
    read: false,
    ts: new Date().toISOString(),
  };
  notificationBuffer.unshift(n);
  if (notificationBuffer.length > MAX_NOTIFICATIONS) notificationBuffer.pop();
  emit('notification:new', n);
  return n;
}

export function getNotifications(limit = 50): Notification[] {
  return notificationBuffer.slice(0, limit);
}

export function getUnreadCount(): number {
  return notificationBuffer.filter(n => !n.read).length;
}

export function markAllRead(): void {
  notificationBuffer = notificationBuffer.map(n => ({ ...n, read: true }));
}

export function markRead(id: string): void {
  const idx = notificationBuffer.findIndex(n => n.id === id);
  if (idx !== -1) notificationBuffer[idx] = { ...notificationBuffer[idx], read: true };
}

// ─── Socket.IO server ─────────────────────────────────────────────────────────

let io: SocketIOServer | null = null;
let pulseTimer: ReturnType<typeof setInterval> | null = null;

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://localhost:4173')
        .split(',').map(o => o.trim()),
      credentials: true,
    },
    transports: ['websocket'],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth as any)?.token ||
      (socket.handshake.query?.token as string);
    if (!token) {
      logger.warn(`Socket auth failed: no token (handshake ${socket.id})`);
      return next(new Error('unauthorized: no token'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme') as any;
      (socket.data as any).user = payload;
      (socket.data as any).userId = payload?.userId || payload?.id || payload?.sub;
      next();
    } catch (err: any) {
      logger.warn(`Socket auth failed: ${err?.message || 'invalid token'}`);
      next(new Error('unauthorized: invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as any).user;
    logger.info(`Socket connected: ${socket.id} user: ${(socket.data as any).userId || user?.username || '?'}`);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} — ${reason}`);
    });

    socket.on('pulse:request', async () => {
      try {
        const pulse = await dashboardService.getRealtimePulse();
        socket.emit('dashboard:pulse', pulse);
      } catch { /* ignore */ }
    });

    // Send current notification state to newly connected client
    socket.emit('notification:init', {
      items: getNotifications(50),
      unread: getUnreadCount(),
    });
  });

  pulseTimer = setInterval(async () => {
    if (!io || io.engine.clientsCount === 0) return;
    try {
      const pulse = await dashboardService.getRealtimePulse();
      io.emit('dashboard:pulse', pulse);
    } catch { /* ignore */ }
  }, 5000);

  logger.info('Socket.IO server initialised');
  return io;
}

export function emit(event: SocketEvent, payload: unknown): void {
  if (!io) return;
  io.emit(event, payload);
}

export function emitTo(socketId: string, event: SocketEvent, payload: unknown): void {
  if (!io) return;
  io.to(socketId).emit(event, payload);
}

export function getIO(): SocketIOServer | null { return io; }

export function shutdownSocketIO(): void {
  if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
  io?.close();
  io = null;
}
