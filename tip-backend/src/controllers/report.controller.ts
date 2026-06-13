import { Response } from 'express';
import path from 'path';
import { AuthRequest } from '../middleware/auth.middleware';
import reportService from '../services/report.service';
import { sendError, sendSuccess, sendCreated } from '../utils/helpers';

export class ReportController {
  async getReports(req: AuthRequest, res: Response) {
    try {
      const { limit = 100 } = req.query;
      const data = await reportService.getReports(Number(limit));
      return sendSuccess(res, data);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await reportService.getReportStats();
      return sendSuccess(res, stats);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async generate(req: AuthRequest, res: Response) {
    try {
      const createdBy = req.user?.userId;
      const report = await reportService.generateReport({ ...req.body, createdBy });
      return sendCreated(res, report, 'Report generated successfully');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getContent(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = await reportService.getReportContent(id);
      return sendSuccess(res, data);
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async download(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const report = await reportService.getReportById(id);
      if (!report.filePath) return sendError(res, 'Report file not available', 404);
      return res.download(report.filePath, path.basename(report.filePath));
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }
}

export default new ReportController();
