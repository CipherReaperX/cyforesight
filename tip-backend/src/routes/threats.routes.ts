import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/recent', authenticate, dashboardController.getRecentThreats);

export default router;
