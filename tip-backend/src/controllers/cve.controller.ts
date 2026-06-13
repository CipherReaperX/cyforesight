import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import cveService from '../services/cve.service';
import { sendSuccess, sendError, paginate } from '../utils/helpers';

export class CVEController {
  async getCVEs(req: AuthRequest, res: Response) {
    try {
      const { skip = 0, take = 25, severity, exploitAvailable, patchStatus, search } = req.query;
      const { limit, offset } = paginate(Number(skip), Number(take));

      const result = await cveService.getCVEs(
        { severity, exploitAvailable, patchStatus, search },
        offset,
        limit
      );

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getCVEById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const cve = await cveService.getCVEById(id);
      sendSuccess(res, cve);
    } catch (error: any) {
      sendError(res, error.message, 404);
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await cveService.getStats();
      sendSuccess(res, stats);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getCriticalCVEs(req: AuthRequest, res: Response) {
    try {
      const { limit = 10 } = req.query;
      const cves = await cveService.getCriticalCVEs(Number(limit));
      sendSuccess(res, cves);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getWithExploits(req: AuthRequest, res: Response) {
    try {
      const { limit = 10 } = req.query;
      const cves = await cveService.getWithExploits(Number(limit));
      sendSuccess(res, cves);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async scanAssets(req: AuthRequest, res: Response) {
    try {
      const result = await cveService.scanAssets();
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }
}

export default new CVEController();

