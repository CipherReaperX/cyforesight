import logger from '../config/logger';
import '../jobs/feedFetch.job';
import '../jobs/enrichment.job';

logger.info('✅ Background workers started');
