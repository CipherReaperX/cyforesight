import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import huntingService from '../services/hunting.service';
import { sendCreated, sendError, sendSuccess } from '../utils/helpers';

export class HuntingController {
  async listQueries(req: AuthRequest, res: Response) {
    try {
      const { limit = 100 } = req.query;
      const data = await huntingService.listSavedQueries(Number(limit));
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async createQuery(req: AuthRequest, res: Response) {
    try {
      const createdBy = req.user?.userId || null;
      const data = await huntingService.createSavedQuery({ ...req.body, createdBy });
      sendCreated(res, data, 'Saved hunt query created');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async updateQuery(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = await huntingService.updateSavedQuery(id, req.body || {});
      sendSuccess(res, data, 'Saved hunt query updated');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async runAdhoc(req: AuthRequest, res: Response) {
    try {
      const { query, dataSource = 'all', hours = 24, limit = 200 } = req.body || {};
      const data = await huntingService.runQuery({
        query,
        dataSource,
        hours: Number(hours),
        limit: Number(limit),
      });
      sendSuccess(res, data, 'Threat hunt completed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async runSaved(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = await huntingService.runSavedQuery(id);
      sendSuccess(res, data, 'Saved hunt executed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async listRuns(req: AuthRequest, res: Response) {
    try {
      const { limit = 50 } = req.query;
      const data = huntingService.listRecentRuns(Number(limit));
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getRun(req: AuthRequest, res: Response) {
    try {
      const { runId } = req.params;
      const data = huntingService.getRunById(runId);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message, 404);
    }
  }

  async triggerAutomation(req: AuthRequest, res: Response) {
    try {
      const { force = true } = req.body || {};
      const data = await huntingService.runScheduledAutomation(!!force);
      sendSuccess(res, data, 'Scheduled threat hunt automation executed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }
}

export default new HuntingController();

