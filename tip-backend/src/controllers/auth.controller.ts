import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import authService from '../services/auth.service';
import { sendSuccess, sendError, sendCreated } from '../utils/helpers';
import logger from '../config/logger';

export class AuthController {
  async login(req: AuthRequest, res: Response) {
    try {
      const { username, password } = req.body;
      const ipAddress = req.ip || 'unknown';

      const result = await authService.login(username, password, ipAddress);
      
      sendSuccess(res, result, 'Login successful');
    } catch (error: any) {
      logger.error('Login error:', error);
      const isClientError = ['Invalid credentials', 'Account is disabled', 'Account is locked. Try again later'].includes(error.message);
      if (isClientError) {
        sendError(res, error.message, 401);
      } else {
        sendError(res, 'Authentication failed', 500);
      }
    }
  }

  async refresh(req: AuthRequest, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return sendError(res, 'refreshToken is required', 400);
      const result = await authService.refreshAccessToken(refreshToken);
      sendSuccess(res, result, 'Token refreshed');
    } catch (error: any) {
      sendError(res, error.message, 401);
    }
  }

  async logout(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, 'Unauthorized', 401);
      }
      await authService.logout(req.user.userId);
      sendSuccess(res, null, 'Logout successful');
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getMe(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, 'Unauthorized', 401);
      }

      const user = await authService.getCurrentUser(req.user.userId);
      sendSuccess(res, user);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async listUsers(req: AuthRequest, res: Response) {
    try {
      const userList = await authService.listUsers();
      sendSuccess(res, userList);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async createUser(req: AuthRequest, res: Response) {
    try {
      const { username, email, password, role, firstName, lastName } = req.body;
      if (!username || !email || !password) {
        return sendError(res, 'username, email, and password are required', 400);
      }
      const user = await authService.createUser({ username, email, password, role, firstName, lastName });
      sendCreated(res, user, 'User created successfully');
    } catch (error: any) {
      sendError(res, error.message, error.message.includes('already exists') ? 409 : 400);
    }
  }

  async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { role, isActive } = req.body;
      const user = await authService.updateUser(id, { role, isActive });
      sendSuccess(res, user, 'User updated successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (req.user && req.user.userId === id) {
        return sendError(res, 'You cannot delete your own account', 400);
      }
      await authService.deleteUser(id);
      sendSuccess(res, null, 'User deleted successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async resetUserPassword(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword) return sendError(res, 'newPassword is required', 400);
      await authService.resetPassword(id, newPassword);
      sendSuccess(res, null, 'Password reset successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getLoginAudit(req: AuthRequest, res: Response) {
    try {
      const logins = await authService.getLoginAudit();
      sendSuccess(res, logins);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, 'Unauthorized', 401);
      }

      const { currentPassword, newPassword } = req.body;
      
      await authService.changePassword(req.user.userId, currentPassword, newPassword);
      
      sendSuccess(res, null, 'Password changed successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }
}

export default new AuthController();
