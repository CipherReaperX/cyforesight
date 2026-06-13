import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import dashboardService from '../services/dashboard.service';
import { sendSuccess, sendError } from '../utils/helpers';

export class DashboardController {
  async getOverview(req: AuthRequest, res: Response) {
    try {
      const { days = 30, limit = 10 } = req.query;
      const overview = await dashboardService.getOverview(Number(days), Number(limit));
      sendSuccess(res, overview);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await dashboardService.getStats();
      sendSuccess(res, stats);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getThreatTrend(req: AuthRequest, res: Response) {
    try {
      const { days = 30 } = req.query;
      const trend = await dashboardService.getThreatTrend(Number(days));
      sendSuccess(res, trend);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getRecentThreats(req: AuthRequest, res: Response) {
    try {
      const { limit = 10 } = req.query;
      const threats = await dashboardService.getRecentThreats(Number(limit));
      sendSuccess(res, threats);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getFeedHealth(req: AuthRequest, res: Response) {
    try {
      const feeds = await dashboardService.getFeedHealth();
      sendSuccess(res, feeds);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getActivityTimeline(req: AuthRequest, res: Response) {
    try {
      const { hours = 24 } = req.query;
      const timeline = await dashboardService.getActivityTimeline(Number(hours));
      sendSuccess(res, timeline);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async stream(req: AuthRequest, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = async () => {
      try {
        const pulse = await dashboardService.getRealtimePulse();
        res.write(`event: pulse\n`);
        res.write(`data: ${JSON.stringify(pulse)}\n\n`);
      } catch (error: any) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message: error?.message || 'stream error' })}\n\n`);
      }
    };

    await send();
    const timer = setInterval(send, 5000);
    req.on('close', () => {
      clearInterval(timer);
      res.end();
    });
  }
}

export default new DashboardController();
