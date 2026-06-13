import { Router } from 'express';
import mitreController from '../controllers/mitre.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/tactics', authenticate, mitreController.getTactics);
router.get('/techniques', authenticate, mitreController.getTechniques);
router.get('/techniques/:id', authenticate, mitreController.getTechniqueById);
router.get('/coverage', authenticate, mitreController.getCoverage);
router.get('/top-techniques', authenticate, mitreController.getTopTechniques);
router.get('/asset-correlation', authenticate, mitreController.getAssetCorrelation);
router.get('/map-status', authenticate, mitreController.getMappingStatus);
router.post('/map-iocs', authenticate, authorize('admin', 'analyst'), mitreController.mapIOCs);

export default router;
