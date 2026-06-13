import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { loginSchema, changePasswordSchema } from '../validators/auth.validator';
import { authLimiter } from '../middleware/ratelimit.middleware';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

// User management (admin only)
router.get('/users', authenticate, authorize('admin'), authController.listUsers);
router.post('/users', authenticate, authorize('admin'), authController.createUser);
router.put('/users/:id', authenticate, authorize('admin'), authController.updateUser);

export default router;
