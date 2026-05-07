import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { bootstrapSecrets } from './utils/secrets';
import { PrismaClient } from '@prisma/client';
import cartRoutes from './routes/cart';
import importRoutes from './routes/import';
import matchRoutes from './routes/match';
import checkoutRoutes from './routes/checkout';
import optimizeRoutes from './routes/optimize';
import autobuyRoutes from './routes/autobuy';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import pricingRoutes from './routes/pricing';
import auditRoutes from './routes/audit';
import privacyRoutes from './routes/privacy';
import listRoutes from './routes/lists';
import alertRoutes from './routes/alerts';
import analyticsRoutes from './routes/analytics';
import shippingRoutes from './routes/shipping';
import adminRoutes from './routes/admin';
import rulesRoutes from './routes/rules';
import budgetRoutes from './routes/budget';
import giftCardRoutes from './routes/giftcards';
import virtualCardRoutes from './routes/virtualcards';
import copilotRoutes from './routes/copilot';
import docsRoutes from './routes/docs';
import { startAutoBuyWorker } from './workers/autoBuyWorker';
import { startPriceSyncWorker } from './workers/priceSyncWorker';
import { logger } from './utils/logger';
import { requestContext } from './middleware/requestContext';
import { getSupportedRetailerNames } from './integrations/registry';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
export const prisma = new PrismaClient();
export const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(requestContext);
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/giftcards', giftCardRoutes);
app.use('/api/virtualcards', virtualCardRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/import', importRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/optimize', optimizeRoutes);
app.use('/api/autobuy', autobuyRoutes);

function healthLive(_req: express.Request, res: express.Response) {
  return res.json({
    status: 'ok',
    service: 'universal-cart-api',
    timestamp: new Date().toISOString(),
  });
}

async function healthReady(_req: express.Request, res: express.Response) {
  const startedAt = Date.now();
  const checks: Record<string, any> = {
    retailerRegistry: {
      status: 'ok',
      supportedRetailers: getSupportedRetailerNames(),
    },
    redis: {
      status: process.env.REDIS_URL ? 'not_configured_in_app' : 'not_required',
    },
    thirdPartyIntegrations: {
      status: 'configuration_only',
      supportedRetailers: getSupportedRetailerNames(),
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'ok',
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    checks.database = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database readiness check failed',
    };
  }

  const ready = checks.database.status === 'ok';
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    service: 'universal-cart-api',
    timestamp: new Date().toISOString(),
    checks,
  });
}

// Health checks
app.get('/health', (_req, res) => res.send('OK'));
app.get('/health/live', healthLive);
app.get('/health/ready', healthReady);
app.get('/api/health', healthLive);
app.get('/api/health/live', healthLive);
app.get('/api/health/ready', healthReady);

if (require.main === module) {
  bootstrapSecrets()
    .then(() => {
      startAutoBuyWorker();
      startPriceSyncWorker();
      app.listen(PORT, () => {
        logger.info(`Server running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      logger.error(`Failed to bootstrap secrets: ${error}`);
      process.exit(1);
    });
}
