import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import integrationController from '../controllers/integration.controller';

const router = Router();

router.get('/', authenticate, integrationController.list);
router.get('/:id', authenticate, integrationController.getOne);
router.patch('/:id/config', authenticate, authorize('admin'), integrationController.updateConfig);
router.post('/:id/enable', authenticate, authorize('admin'), integrationController.enable);
router.post('/:id/disable', authenticate, authorize('admin'), integrationController.disable);
router.post('/:id/test', authenticate, authorize('admin', 'analyst'), integrationController.test);
router.post('/virustotal/lookup', authenticate, integrationController.lookup);

export default router;
