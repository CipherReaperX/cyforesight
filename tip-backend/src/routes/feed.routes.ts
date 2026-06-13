import { Router } from 'express';
import feedController from '../controllers/feed.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, feedController.getFeeds);
router.post('/sync-all', authenticate, authorize('admin', 'analyst'), feedController.syncAllFeeds);
router.get('/:id', authenticate, feedController.getFeedById);
router.post('/', authenticate, authorize('admin'), feedController.createFeed);
router.patch('/:id', authenticate, authorize('admin'), feedController.updateFeed);
router.put('/:id', authenticate, authorize('admin'), feedController.updateFeed);
router.delete('/:id', authenticate, authorize('admin'), feedController.deleteFeed);
router.post('/:id/sync', authenticate, authorize('admin', 'analyst'), feedController.syncFeed);
router.post('/:id/pause', authenticate, authorize('admin'), feedController.pauseFeed);
router.post('/:id/resume', authenticate, authorize('admin'), feedController.resumeFeed);

export default router;
