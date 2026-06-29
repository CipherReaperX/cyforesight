import { Router } from 'express';
import settingsController from '../controllers/settings.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Platform settings (admin only)
router.get('/', authenticate, authorize('admin'), settingsController.getSettings);
router.put('/', authenticate, authorize('admin'), settingsController.updateSettings);

// API keys (admin only)
router.get('/api-keys', authenticate, authorize('admin'), settingsController.getApiKeys);
router.post('/api-keys', authenticate, authorize('admin'), settingsController.saveApiKey);
router.post('/api-keys/:service/test', authenticate, authorize('admin'), settingsController.testApiKey);
router.delete('/api-keys/:service', authenticate, authorize('admin'), settingsController.deleteApiKey);

// Notification preferences (current user)
router.get('/notification-prefs', authenticate, settingsController.getNotificationPrefs);
router.put('/notification-prefs', authenticate, settingsController.updateNotificationPrefs);

export default router;
