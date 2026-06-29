import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// User management — list readable by admin & analyst; mutations admin only
router.get('/', authenticate, authorize('admin', 'analyst'), authController.listUsers);
router.post('/', authenticate, authorize('admin'), authController.createUser);
router.patch('/:id', authenticate, authorize('admin'), authController.updateUser);
router.put('/:id', authenticate, authorize('admin'), authController.updateUser);
router.delete('/:id', authenticate, authorize('admin'), authController.deleteUser);
router.post('/:id/reset-password', authenticate, authorize('admin'), authController.resetUserPassword);

export default router;
