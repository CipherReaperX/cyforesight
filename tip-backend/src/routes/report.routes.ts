import { Router } from 'express';
import reportController from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, reportController.getReports);
router.get('/stats', authenticate, reportController.getStats);
router.post('/generate', authenticate, authorize('admin', 'analyst'), reportController.generate);
router.get('/:id/content', authenticate, reportController.getContent);
router.get('/:id/download', authenticate, reportController.download);

export default router;
