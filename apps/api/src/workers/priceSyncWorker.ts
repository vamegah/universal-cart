import cron from 'node-cron';
import { prisma } from '../index';
import { getRetailerDefinitionByName } from '../integrations/registry';
import { refreshAlerts } from '../services/alertRefreshService';
import { runRetailerRequest } from '../services/retailerRequestService';
import { logger } from '../utils/logger';

// Default: every 30 minutes. Override with ALERT_REFRESH_CRON env var.
const SCHEDULE = process.env.ALERT_REFRESH_CRON ?? '*/30 * * * *';
const DEFAULT_BATCH_SIZE = 20;

interface PriceSyncSummary {
  scanned: number;
  refreshed: number;
  failed: number;
  skipped: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function inferInStock(currentInStock: boolean, availability?: string): boolean {
  if (!availability) return currentInStock;
  const normalized = availability.toLowerCase().replace(/[\s_-]/g, '');
  if (
    normalized.includes('outofstock') ||
    normalized.includes('soldout') ||
    normalized.includes('unavailable') ||
    normalized.includes('discontinued')
  ) {
    return false;
  }
  if (normalized.includes('instock') || normalized.includes('available')) {
    return true;
  }
  return currentInStock;
}

async function refreshRetailerListing(listing: {
  id: string;
  retailerName: string;
  url: string;
  inStock: boolean;
}): Promise<'refreshed' | 'skipped'> {
  const definition = getRetailerDefinitionByName(listing.retailerName);
  if (!definition) {
    logger.warn(`Price sync worker: unsupported retailer "${listing.retailerName}" for listing ${listing.id}`);
    return 'skipped';
  }

  const adapter = new definition.adapter();
  const productData = await runRetailerRequest(listing.retailerName, 'price refresh', () => adapter.fetchProduct(listing.url));
  const price = Number(productData.price);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Adapter returned invalid price for listing ${listing.id}`);
  }

  await prisma.retailerProduct.update({
    where: { id: listing.id },
    data: {
      price,
      inStock: inferInStock(listing.inStock, productData.availability),
      lastUpdated: new Date(),
    },
  });

  await prisma.priceHistory.create({
    data: {
      retailerProductId: listing.id,
      price,
    },
  });

  return 'refreshed';
}

export async function refreshRetailerPrices(batchSize = DEFAULT_BATCH_SIZE): Promise<PriceSyncSummary> {
  const listings = await prisma.retailerProduct.findMany({
    where: {
      url: { not: '' },
    },
    select: {
      id: true,
      retailerName: true,
      url: true,
      inStock: true,
    },
  });

  const summary: PriceSyncSummary = {
    scanned: listings.length,
    refreshed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const batch of chunk(listings, Math.max(1, batchSize))) {
    const results = await Promise.allSettled(batch.map((listing) => refreshRetailerListing(listing)));

    results.forEach((result, index) => {
      const listing = batch[index];
      if (result.status === 'fulfilled') {
        if (result.value === 'refreshed') summary.refreshed += 1;
        if (result.value === 'skipped') summary.skipped += 1;
        return;
      }

      summary.failed += 1;
      logger.error(
        `Price sync worker: failed to refresh ${listing.retailerName} listing ${listing.id}: ${result.reason}`
      );
    });
  }

  logger.info(
    `Price sync worker: refreshed ${summary.refreshed}/${summary.scanned} listings (${summary.failed} failed, ${summary.skipped} skipped)`
  );

  return summary;
}

export function startPriceSyncWorker(): void {
  if (!cron.validate(SCHEDULE)) {
    logger.error(`Invalid ALERT_REFRESH_CRON expression: "${SCHEDULE}" — price sync worker not started`);
    return;
  }

  cron.schedule(SCHEDULE, async () => {
    logger.info('Price sync worker: starting alert refresh');
    try {
      await refreshAlerts();
      logger.info('Price sync worker: alert refresh complete');
      await refreshRetailerPrices();
    } catch (error) {
      logger.error(`Price sync worker error: ${error}`);
    }
  });

  logger.info(`Price sync worker scheduled (${SCHEDULE})`);
}
