import cron from 'node-cron';
import { evaluateAutoBuyRules } from '../services/autoBuyScheduler';
import { logger } from '../utils/logger';

export function startAutoBuyWorker() {
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Running auto-buy worker');
    await evaluateAutoBuyRules();
  });
}