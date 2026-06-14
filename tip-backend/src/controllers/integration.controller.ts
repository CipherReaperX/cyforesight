import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as integrationService from '../services/integration.service';
import { sendSuccess, sendError } from '../utils/helpers';

export class IntegrationController {
  async list(req: AuthRequest, res: Response) {
    try {
      const rows = await integrationService.list();
      sendSuccess(res, rows);
    } catch (e: any) { sendError(res, e.message); }
  }

  async getOne(req: AuthRequest, res: Response) {
    try {
      const row = await integrationService.getById(req.params.id);
      sendSuccess(res, row);
    } catch (e: any) { sendError(res, e.message, 404); }
  }

  async updateConfig(req: AuthRequest, res: Response) {
    try {
      const updated = await integrationService.updateConfig(req.params.id, req.body);
      sendSuccess(res, updated, 'Integration config saved');
    } catch (e: any) { sendError(res, e.message); }
  }

  async enable(req: AuthRequest, res: Response) {
    try {
      const updated = await integrationService.setEnabled(req.params.id, true);
      sendSuccess(res, updated, 'Integration enabled');
    } catch (e: any) { sendError(res, e.message); }
  }

  async disable(req: AuthRequest, res: Response) {
    try {
      const updated = await integrationService.setEnabled(req.params.id, false);
      sendSuccess(res, updated, 'Integration disabled');
    } catch (e: any) { sendError(res, e.message); }
  }

  async test(req: AuthRequest, res: Response) {
    try {
      const result = await integrationService.testIntegration(req.params.id);
      sendSuccess(res, result, result.success ? 'Test passed' : 'Test failed');
    } catch (e: any) { sendError(res, e.message); }
  }

  async lookup(req: AuthRequest, res: Response) {
    // VirusTotal on-demand lookup
    try {
      const { value, type, apiKey } = req.body;
      if (!value || !type) return sendError(res, 'value and type are required', 400);
      const result = await integrationService.lookupVirusTotal(value, type, apiKey);
      sendSuccess(res, result, 'Lookup complete');
    } catch (e: any) { sendError(res, e.message); }
  }
}

export default new IntegrationController();
