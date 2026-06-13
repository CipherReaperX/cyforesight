import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import feedService from '../services/feed.service';
import { sendSuccess, sendError, sendCreated, sendNoContent, sendAccepted } from '../utils/helpers';

export class FeedController {
  async getFeeds(req: AuthRequest, res: Response) {
    try {
      const feeds = await feedService.getFeeds();
      sendSuccess(res, feeds);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getFeedById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const feed = await feedService.getFeedById(id);
      sendSuccess(res, feed);
    } catch (error: any) {
      sendError(res, error.message, 404);
    }
  }

  async createFeed(req: AuthRequest, res: Response) {
    try {
      const feed = await feedService.createFeed(req.body);
      sendCreated(res, feed, 'Feed created successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async updateFeed(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const feed = await feedService.updateFeed(id, req.body);
      sendSuccess(res, feed, 'Feed updated successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async deleteFeed(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await feedService.deleteFeed(id);
      sendNoContent(res);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async pauseFeed(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await feedService.pauseFeed(id);
      sendSuccess(res, null, 'Feed paused successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async resumeFeed(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await feedService.resumeFeed(id);
      sendSuccess(res, null, 'Feed resumed successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async syncFeed(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { mode = 'immediate' } = req.query;
      const timeoutMs = Number(req.query.timeoutMs || 8000);

      if (String(mode) === 'queued') {
        await feedService.syncFeed(id);
        return sendSuccess(res, { mode: 'queued', feedId: id }, 'Feed sync queued successfully');
      }

      const result = await feedService.syncFeedNow(id, timeoutMs);
      return sendSuccess(res, result, 'Feed synced successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async syncAllFeeds(req: AuthRequest, res: Response) {
    try {
      const timeoutMs = Number(req.query.timeoutMs || 8000);
      const wait = String(req.query.wait || 'false').toLowerCase() === 'true';

      if (!wait) {
        void feedService.syncAllActiveFeedsNow(timeoutMs).catch((error) => {
          console.error('syncAllActiveFeedsNow failed:', error?.message || error);
        });
        return sendAccepted(res, { mode: 'async', timeoutMs }, 'Active feed sync started');
      }

      const result = await feedService.syncAllActiveFeedsNow(timeoutMs);
      return sendSuccess(res, result, 'Active feeds synced successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }
}

export default new FeedController();
