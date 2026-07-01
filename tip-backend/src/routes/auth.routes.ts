import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { loginSchema, changePasswordSchema } from '../validators/auth.validator';
import { authLimiter } from '../middleware/ratelimit.middleware';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

// Recent login audit log
router.get('/audit-log', authenticate, authorize('admin', 'analyst'), authController.getLoginAudit);

// User management (admin only)
router.get('/users', authenticate, authorize('admin'), authController.listUsers);
router.post('/users', authenticate, authorize('admin'), authController.createUser);
router.put('/users/:id', authenticate, authorize('admin'), authController.updateUser);
router.patch('/users/:id', authenticate, authorize('admin'), authController.updateUser);
router.delete('/users/:id', authenticate, authorize('admin'), authController.deleteUser);
router.post('/users/:id/reset-password', authenticate, authorize('admin'), authController.resetUserPassword);

export default router;
