import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import logger from './logger';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

// Create queues
export const feedFetchQueue = new Queue('feed-fetch', { connection });
export const enrichmentQueue = new Queue('enrichment', { connection });
export const threatScoringQueue = new Queue('threat-scoring', { connection });
export const cveSyncQueue = new Queue('cve-sync', { connection });

// Queue events for monitoring
const feedEvents = new QueueEvents('feed-fetch', { connection });
const enrichmentEvents = new QueueEvents('enrichment', { connection });

feedEvents.on('completed', ({ jobId }) => {
  logger.info(`Feed fetch job ${jobId} completed`);
});

feedEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Feed fetch job ${jobId} failed: ${failedReason}`);
});

enrichmentEvents.on('completed', ({ jobId }) => {
  logger.info(`Enrichment job ${jobId} completed`);
});

enrichmentEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Enrichment job ${jobId} failed: ${failedReason}`);
});

logger.info('✅ BullMQ queues initialized');

export { connection };

