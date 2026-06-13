import { Router } from 'express';
import threatFeedsController from '../controllers/threatFeeds.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Get all threat feeds
router.get('/', authenticate, threatFeedsController.getAllThreatFeeds);

// Get threat feed by ID
router.get('/:id', authenticate, threatFeedsController.getThreatFeedById);

// Create new threat feed (admin only)
router.post('/', authenticate, authorize('admin'), threatFeedsController.createThreatFeed);

// Update threat feed by ID (admin only)
router.put('/:id', authenticate, authorize('admin'), threatFeedsController.updateThreatFeed);

// Delete threat feed by ID (admin only)
router.delete('/:id', authenticate, authorize('admin'), threatFeedsController.deleteThreatFeed);

export default router;
