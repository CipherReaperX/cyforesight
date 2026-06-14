import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getNotifications, getUnreadCount, markAllRead, markRead } from '../services/socket.service';
import { sendSuccess } from '../utils/helpers';

export class NotificationController {
  list(req: AuthRequest, res: Response) {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const items = getNotifications(limit);
    sendSuccess(res, { items, unread: getUnreadCount() });
  }

  markAllRead(_req: AuthRequest, res: Response) {
    markAllRead();
    sendSuccess(res, { unread: 0 });
  }

  markOne(req: AuthRequest, res: Response) {
    markRead(req.params.id);
    sendSuccess(res, { unread: getUnreadCount() });
  }
}

export default new NotificationController();
