import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import dashboardService from '../services/dashboard.service';
import { sendSuccess, sendError } from '../utils/helpers';

export class DashboardController {
  async getOverview(req: AuthRequest, res: Response) {
    try {
      const { days = 30, limit = 10, refresh } = req.query;
      const overview = await dashboardService.getOverview(Number(days), Number(limit), refresh === 'true');
      sendSuccess(res, overview);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const { refresh } = req.query;
      const stats = await dashboardService.getStats(refresh === 'true');
      sendSuccess(res, stats);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getThreatTrend(req: AuthRequest, res: Response) {
    try {
      const { days = 30, refresh } = req.query;
      const trend = await dashboardService.getThreatTrend(Number(days), refresh === 'true');
      sendSuccess(res, trend);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getRecentThreats(req: AuthRequest, res: Response) {
    try {
      const { limit = 10, refresh } = req.query;
      const threats = await dashboardService.getRecentThreats(Number(limit), refresh === 'true');
      sendSuccess(res, threats);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getFeedHealth(req: AuthRequest, res: Response) {
    try {
      const { refresh } = req.query;
      const feeds = await dashboardService.getFeedHealth(refresh === 'true');
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

  async getGeoThreats(req: AuthRequest, res: Response) {
    try {
      const { refresh } = req.query;
      const data = await dashboardService.getGeoThreats(refresh === 'true');
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async invalidateCache(req: AuthRequest, res: Response) {
    try {
      await dashboardService.invalidateCache();
      sendSuccess(res, { message: 'Dashboard cache cleared' });
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
