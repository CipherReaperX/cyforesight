import { Router } from 'express';

import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import iocRoutes from './ioc.routes';
import assetRoutes from './asset.routes';
import cveRoutes from './cve.routes';
import mitreRoutes from './mitre.routes';
import feedRoutes from './feed.routes';
import threatsRoutes from './threats.routes';
import threatFeedsRoutes from './threatFeeds.routes';  // Added missing threatFeeds route
import reconRoutes from './recon.routes';
import reportRoutes from './report.routes';
import incidentRoutes from './incident.routes';
import huntingRoutes from './hunting.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/iocs', iocRoutes);
router.use('/assets', assetRoutes);
router.use('/cves', cveRoutes);
router.use('/mitre', mitreRoutes);
router.use('/feeds', feedRoutes);
router.use('/threats', threatsRoutes);
router.use('/threat-feeds', threatFeedsRoutes);  // Register the threat feeds route
router.use('/recon', reconRoutes);
router.use('/reports', reportRoutes);
router.use('/incidents', incidentRoutes);
router.use('/hunting', huntingRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
