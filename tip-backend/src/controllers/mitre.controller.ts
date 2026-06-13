import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import mitreService from '../services/mitre.service';
import { sendSuccess, sendError, sendAccepted } from '../utils/helpers';

export class MitreController {
  async getTactics(req: AuthRequest, res: Response) {
    try {
      const tactics = await mitreService.getTactics();
      sendSuccess(res, tactics);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getTechniques(req: AuthRequest, res: Response) {
    try {
      const { tactic, platform, hasDetections, search, limit } = req.query;
      const techniques = await mitreService.getTechniques({ tactic, platform, hasDetections, search, limit });
      sendSuccess(res, techniques);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getTechniqueById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const technique = await mitreService.getTechniqueById(id);
      sendSuccess(res, technique);
    } catch (error: any) {
      sendError(res, error.message, 404);
    }
  }

  async getCoverage(req: AuthRequest, res: Response) {
    try {
      const coverage = await mitreService.getCoverage();
      sendSuccess(res, coverage);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getTopTechniques(req: AuthRequest, res: Response) {
    try {
      const { limit = 10 } = req.query;
      const techniques = await mitreService.getTopTechniques(Number(limit));
      sendSuccess(res, techniques);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async mapIOCs(req: AuthRequest, res: Response) {
    try {
      const { batchSize = 2000, maxBatches = 10, async = true } = req.body || {};
      if (async) {
        void mitreService.mapIOCsToTechniques(Number(batchSize), Number(maxBatches));
        return sendAccepted(res, mitreService.getMappingStatus(), 'IOC MITRE mapping started');
      }
      const result = await mitreService.mapIOCsToTechniques(Number(batchSize), Number(maxBatches));
      return sendSuccess(res, result, 'IOC MITRE mapping completed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getMappingStatus(req: AuthRequest, res: Response) {
    try {
      sendSuccess(res, mitreService.getMappingStatus());
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getAssetCorrelation(req: AuthRequest, res: Response) {
    try {
      const { limitTechniques = 100, assetsPerTechnique = 8 } = req.query;
      const result = await mitreService.getAssetCorrelation({
        limitTechniques: Number(limitTechniques),
        assetsPerTechnique: Number(assetsPerTechnique),
      });
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }
}

export default new MitreController();
