import { Router } from 'express';
import multer from 'multer';
import assetController from '../controllers/asset.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createAssetSchema, updateAssetSchema } from '../validators/asset.validator';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', authenticate, assetController.getAssets);
router.get('/stats', authenticate, assetController.getStats);
router.get('/export', authenticate, assetController.exportAssets);
router.get('/risk-distribution', authenticate, assetController.getRiskDistribution);
router.get('/priorities', authenticate, assetController.getExposurePriorities);
router.post('/bootstrap-small-enterprise', authenticate, authorize('admin', 'analyst'), assetController.bootstrapSmallEnterprise);
router.post('/map-iocs', authenticate, authorize('admin', 'analyst'), assetController.mapIOCsToAssets);
router.post('/:id/scan', authenticate, authorize('admin', 'analyst'), assetController.scanAsset);
router.post('/:id/recheck-vt', authenticate, authorize('admin', 'analyst'), assetController.recheckAssetIOCsVT);
router.get('/:id/vulnerabilities', authenticate, assetController.getAssetVulnerabilities);
router.get('/:id/threats', authenticate, assetController.getAssetThreats);
router.get('/:id', authenticate, assetController.getAssetById);

router.post('/', authenticate, authorize('admin', 'analyst'), validate(createAssetSchema), assetController.createAsset);
// Bulk CSV upload endpoint:
router.post(
  '/upload-csv',
  authenticate,
  authorize('admin', 'analyst'), // Optional: restrict as needed
  upload.single('file'),
  assetController.uploadCSV // <-- Implement this function in your controller!
);

router.put('/:id', authenticate, authorize('admin', 'analyst'), validate(updateAssetSchema), assetController.updateAsset);
router.delete('/:id', authenticate, authorize('admin'), assetController.deleteAsset);

export default router;
