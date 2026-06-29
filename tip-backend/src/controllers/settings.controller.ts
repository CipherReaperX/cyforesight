import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import settingsService from '../services/settings.service';
import { sendSuccess, sendError } from '../utils/helpers';
import logger from '../config/logger';

export class SettingsController {
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await settingsService.bulkGetSettings();
      sendSuccess(res, settings);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const body = req.body || {};
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(body)) {
        if (v === null || v === undefined) continue;
        flat[k] = String(v);
      }
      const updated = await settingsService.bulkSetSettings(flat);
      sendSuccess(res, updated, 'Settings saved');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getApiKeys(req: AuthRequest, res: Response) {
    try {
      const keys = await settingsService.getApiKeys();
      sendSuccess(res, keys);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async saveApiKey(req: AuthRequest, res: Response) {
    try {
      const { service, key } = req.body || {};
      if (!service || !key) return sendError(res, 'service and key are required', 400);
      const result = await settingsService.saveApiKey(service, key);
      sendSuccess(res, result, 'API key saved');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async testApiKey(req: AuthRequest, res: Response) {
    try {
      const { service } = req.params;
      const { key } = req.body || {};
      const result = await settingsService.testApiKey(service, key);
      sendSuccess(res, result, result.status === 'ok' ? 'API key is valid' : 'API key test failed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async deleteApiKey(req: AuthRequest, res: Response) {
    try {
      const { service } = req.params;
      await settingsService.deleteApiKey(service);
      sendSuccess(res, null, 'API key removed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getNotificationPrefs(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);
      const prefs = await settingsService.getNotificationPrefs(req.user.userId);
      sendSuccess(res, prefs);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async updateNotificationPrefs(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);
      const prefs = Array.isArray(req.body?.prefs) ? req.body.prefs : req.body;
      if (!Array.isArray(prefs)) return sendError(res, 'prefs array is required', 400);
      const saved = await settingsService.setNotificationPrefs(req.user.userId, prefs);
      sendSuccess(res, saved, 'Notification preferences saved');
    } catch (error: any) {
      logger.error('updateNotificationPrefs error:', error);
      sendError(res, error.message, 400);
    }
  }
}

export default new SettingsController();
