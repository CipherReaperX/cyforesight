import { Router } from 'express';
import cveController from '../controllers/cve.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Static routes BEFORE /:id to avoid param shadowing
router.get('/', authenticate, cveController.getCVEs);
router.get('/stats', authenticate, cveController.getStats);
router.get('/export', authenticate, cveController.export);
router.post('/scan-assets', authenticate, authorize('admin', 'analyst'), cveController.scanAssets);
router.get('/:id', authenticate, cveController.getCVEById);
router.patch('/:id', authenticate, authorize('admin', 'analyst'), cveController.update);

export default router;
