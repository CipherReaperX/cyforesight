import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import reconService from '../services/recon.service';
import { sendError, sendSuccess } from '../utils/helpers';

function getQueryValue(req: AuthRequest): string {
  return String(req.query.query || req.body?.query || '').trim();
}

export class ReconController {
  async whoisLookup(req: AuthRequest, res: Response) {
    try {
      const query = getQueryValue(req);
      if (!query) return sendError(res, 'Query is required', 400);
      const data = await reconService.whoisLookup(query);
      return sendSuccess(res, data);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async dnsLookup(req: AuthRequest, res: Response) {
    try {
      const query = getQueryValue(req);
      if (!query) return sendError(res, 'Query is required', 400);
      const data = await reconService.dnsLookup(query);
      return sendSuccess(res, data);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async geoipLookup(req: AuthRequest, res: Response) {
    try {
      const query = getQueryValue(req);
      if (!query) return sendError(res, 'Query is required', 400);
      const data = await reconService.geoipLookup(query);
      return sendSuccess(res, data);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async sslLookup(req: AuthRequest, res: Response) {
    try {
      const query = getQueryValue(req);
      if (!query) return sendError(res, 'Query is required', 400);
      const data = await reconService.sslLookup(query);
      return sendSuccess(res, data);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export default new ReconController();
