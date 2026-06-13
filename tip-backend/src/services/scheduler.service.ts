import { CronJob } from 'cron';
import { feedFetchQueue, enrichmentQueue, threatScoringQueue } from '../config/queue';
import db from '../config/database';
import { threatFeeds, iocs } from '../models/schema';
import { desc } from 'drizzle-orm';
import logger from '../config/logger';
import huntingService from './hunting.service';

const feedFetchJob = new CronJob('0 * * * *', async () => {
  logger.info('🕐 Starting scheduled feed fetch...');
  
  try {
    const feeds = await db.select().from(threatFeeds);
    logger.info(`📊 Found ${feeds.length} feeds`);

    for (const feed of feeds) {
      if (feed.url && feed.name) {
        await feedFetchQueue.add('fetch-feed', {
          feedId: feed.id,
          feedName: feed.name,
          feedUrl: feed.url,
          feedType: feed.type,
        });
        logger.info(`📥 Queued feed: ${feed.name}`);
      }
    }
  } catch (error: any) {
    logger.error('❌ Feed fetch job error:', error.message);
  }
});

const enrichmentJob = new CronJob('*/15 * * * *', async () => {
  logger.info('🔍 Starting scheduled enrichment...');
  
  try {
    const recentIOCs = await db.select().from(iocs).orderBy(desc(iocs.createdAt)).limit(50);
    logger.info(`📊 Found ${recentIOCs.length} IOCs to enrich`);

    for (const ioc of recentIOCs) {
      if (ioc.value && ioc.type) {
        await enrichmentQueue.add('enrich-ioc', {
          iocId: ioc.id,
          iocValue: ioc.value,
          iocType: ioc.type,
        });
      }
    }
    
    if (recentIOCs.length > 0) {
      logger.info(`🔬 Queued ${recentIOCs.length} IOCs for enrichment`);
    }
  } catch (error: any) {
    logger.error('❌ Enrichment job error:', error.message);
  }
});

const scoringJob = new CronJob('*/30 * * * *', async () => {
  logger.info('📊 Starting threat scoring...');
  
  try {
    const recentIOCs = await db.select().from(iocs).orderBy(desc(iocs.createdAt)).limit(100);
    logger.info(`📊 Found ${recentIOCs.length} IOCs to score`);

    for (const ioc of recentIOCs) {
      if (ioc.id && ioc.type && ioc.value) {
        await threatScoringQueue.add('score-threat', {
          iocId: ioc.id,
          iocType: ioc.type,
          iocValue: ioc.value,
        });
      }
    }
    
    if (recentIOCs.length > 0) {
      logger.info(`📈 Queued ${recentIOCs.length} IOCs for scoring`);
    }
  } catch (error: any) {
    logger.error('❌ Scoring job error:', error.message);
  }
});

const huntAutomationJob = new CronJob('*/10 * * * *', async () => {
  logger.info('🧭 Running scheduled threat hunting automation...');
  try {
    const result = await huntingService.runScheduledAutomation(false);
    logger.info(`✅ Threat hunting automation done: ${result.triggered}/${result.scheduled} queries executed`);
  } catch (error: any) {
    logger.error('❌ Threat hunting automation error:', error.message);
  }
});

export function startScheduler() {
  logger.info('⏰ Starting scheduler...');
  
  feedFetchJob.start();
  enrichmentJob.start();
  scoringJob.start();
  huntAutomationJob.start();
  
  logger.info('✅ Scheduler started - Jobs will run automatically');
  logger.info('📅 Feed Fetch: Every hour (on the hour)');
  logger.info('📅 Enrichment: Every 15 minutes');
  logger.info('📅 Threat Scoring: Every 30 minutes');
  logger.info('📅 Threat Hunting Automation: Every 10 minutes');
  
  const runOnStartup = (process.env.SCHEDULER_RUN_ON_START || 'false').toLowerCase() === 'true';
  if (runOnStartup) {
    logger.info('🚀 Triggering initial jobs...');
    feedFetchJob.fireOnTick();
    enrichmentJob.fireOnTick();
  } else {
    logger.info('⏭️  Initial scheduler run disabled (set SCHEDULER_RUN_ON_START=true to enable)');
  }
}

export function stopScheduler() {
  feedFetchJob.stop();
  enrichmentJob.stop();
  scoringJob.stop();
  huntAutomationJob.stop();
  logger.info('⏹️  Scheduler stopped');
}
