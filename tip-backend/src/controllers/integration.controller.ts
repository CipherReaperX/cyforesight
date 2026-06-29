import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as integrationService from '../services/integration.service';
import { sendSuccess, sendError } from '../utils/helpers';

export class IntegrationController {
  async list(req: AuthRequest, res: Response) {
    try {
      const rows = await integrationService.list();
      sendSuccess(res, rows.map(integrationService.maskRow));
    } catch (e: any) { sendError(res, e.message); }
  }

  async getOne(req: AuthRequest, res: Response) {
    try {
      const row = await integrationService.getById(req.params.id);
      sendSuccess(res, integrationService.maskRow(row));
    } catch (e: any) { sendError(res, e.message, 404); }
  }

  async updateConfig(req: AuthRequest, res: Response) {
    try {
      // Accept both a flat config body and a { config: {...} } wrapper
      const body = req.body && typeof req.body.config === 'object' ? req.body.config : req.body;
      const updated = await integrationService.updateConfig(req.params.id, body);
      sendSuccess(res, integrationService.maskRow(updated), 'Integration config saved');
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
      const masked = { ...result, integration: integrationService.maskRow(result.integration as any) };
      sendSuccess(res, masked, result.success ? 'Test passed' : 'Test failed');
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
