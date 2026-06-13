import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/overview', authenticate, dashboardController.getOverview);
router.get('/stats', authenticate, dashboardController.getStats);
router.get('/threat-trend', authenticate, dashboardController.getThreatTrend);
router.get('/recent-threats', authenticate, dashboardController.getRecentThreats);
router.get('/feed-health', authenticate, dashboardController.getFeedHealth);
router.get('/activity-timeline', authenticate, dashboardController.getActivityTimeline);
router.get('/geo-threats', authenticate, dashboardController.getGeoThreats);
router.get('/stream', authenticate, dashboardController.stream);
router.post('/invalidate-cache', authenticate, dashboardController.invalidateCache);

export default router;
