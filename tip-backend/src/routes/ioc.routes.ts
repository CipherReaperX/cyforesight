import { Router } from 'express';
import multer from 'multer';
import iocController from '../controllers/ioc.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createIOCSchema, updateIOCSchema, getIOCsSchema } from '../validators/ioc.validator';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', authenticate, validate(getIOCsSchema), iocController.getIOCs);
router.get('/distribution', authenticate, iocController.getIOCDistribution);
router.get('/threat-actors', authenticate, iocController.getThreatActors);
router.get('/fresh', authenticate, iocController.getFreshIOCs);
router.get('/export', authenticate, iocController.exportIOCs);
router.get('/anomalies', authenticate, iocController.getAnomalies);
router.post('/bootstrap-diverse', authenticate, authorize('admin', 'analyst'), iocController.bootstrapDiverse);
router.post('/upload-csv', authenticate, authorize('admin', 'analyst'), upload.single('file'), iocController.uploadCSV);
router.get('/:id/enrichment', authenticate, iocController.getEnrichment);
router.get('/:id/related', authenticate, iocController.getRelatedIOCs);
router.get('/:id', authenticate, iocController.getIOCById);
router.post('/', authenticate, authorize('admin', 'analyst'), validate(createIOCSchema), iocController.createIOC);
router.put('/:id', authenticate, authorize('admin', 'analyst'), validate(updateIOCSchema), iocController.updateIOC);
router.delete('/:id', authenticate, authorize('admin'), iocController.deleteIOC);

export default router;
