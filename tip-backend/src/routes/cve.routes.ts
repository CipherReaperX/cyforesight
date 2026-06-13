import { Router } from 'express';
import cveController from '../controllers/cve.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, cveController.getCVEs);
router.get('/stats', authenticate, cveController.getStats);
router.get('/:id', authenticate, cveController.getCVEById);

export default router;
