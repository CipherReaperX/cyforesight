import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import notificationController from '../controllers/notification.controller';

const router = Router();

router.get('/', authenticate, notificationController.list);
router.post('/read-all', authenticate, notificationController.markAllRead);
router.post('/:id/read', authenticate, notificationController.markOne);

export default router;
