import { Router } from 'express';
import reconController from '../controllers/recon.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/whois', authenticate, reconController.whoisLookup);
router.get('/dns', authenticate, reconController.dnsLookup);
router.get('/geoip', authenticate, reconController.geoipLookup);
router.get('/ssl', authenticate, reconController.sslLookup);

export default router;
