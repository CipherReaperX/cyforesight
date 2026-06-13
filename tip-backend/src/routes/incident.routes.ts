import { Router } from 'express';
import incidentController from '../controllers/incident.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, incidentController.list);
router.get('/stats', authenticate, incidentController.stats);
router.post('/bootstrap', authenticate, authorize('admin', 'analyst'), incidentController.bootstrap);
router.get('/:id', authenticate, incidentController.getById);
router.patch('/:id', authenticate, authorize('admin', 'analyst'), incidentController.update);

export default router;

