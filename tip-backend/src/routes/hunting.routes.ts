import { Router } from 'express';
import huntingController from '../controllers/hunting.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/queries', authenticate, huntingController.listQueries);
router.post('/queries', authenticate, authorize('admin', 'analyst'), huntingController.createQuery);
router.patch('/queries/:id', authenticate, authorize('admin', 'analyst'), huntingController.updateQuery);

router.post('/run', authenticate, authorize('admin', 'analyst'), huntingController.runAdhoc);
router.post('/queries/:id/run', authenticate, authorize('admin', 'analyst'), huntingController.runSaved);

router.get('/runs', authenticate, huntingController.listRuns);
router.get('/runs/:runId', authenticate, huntingController.getRun);

router.post('/automation/run', authenticate, authorize('admin', 'analyst'), huntingController.triggerAutomation);

export default router;

