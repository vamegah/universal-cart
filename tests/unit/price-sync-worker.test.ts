import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const findMany = jest.fn<() => Promise<any[]>>();
const update = jest.fn<(args: any) => Promise<any>>();
const createPriceHistory = jest.fn<(args: any) => Promise<any>>();
const fetchProduct = jest.fn<(url: string) => Promise<any>>();
const getRetailerDefinitionByName = jest.fn<(name: string) => any>();

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    retailerProduct: {
      findMany,
      update,
    },
    priceHistory: {
      create: createPriceHistory,
    },
  },
}));

jest.mock('../../apps/api/src/integrations/registry', () => ({
  getRetailerDefinitionByName,
}));

jest.mock('../../apps/api/src/services/alertRefreshService', () => ({
  refreshAlerts: jest.fn(),
}));

jest.mock('../../apps/api/src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { refreshRetailerPrices } from '../../apps/api/src/workers/priceSyncWorker';

describe('priceSyncWorker refreshRetailerPrices', () => {
  beforeEach(() => {
    findMany.mockReset();
    update.mockReset();
    createPriceHistory.mockReset();
    fetchProduct.mockReset();
    getRetailerDefinitionByName.mockReset();
  });

  it('refreshes retailer listings with adapter price and stock data', async () => {
    findMany.mockResolvedValue([
      {
        id: 'rp-1',
        retailerName: 'Amazon',
        url: 'https://www.amazon.com/dp/B0ABC12345',
        inStock: true,
      },
    ]);
    fetchProduct.mockResolvedValue({ price: 44.99, availability: 'https://schema.org/InStock' });
    getRetailerDefinitionByName.mockReturnValue({
      adapter: class {
        fetchProduct = fetchProduct;
      },
    });

    const summary = await refreshRetailerPrices();

    expect(summary).toEqual({ scanned: 1, refreshed: 1, failed: 0, skipped: 0 });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'rp-1' },
      data: {
        price: 44.99,
        inStock: true,
        lastUpdated: expect.any(Date),
      },
    });
    expect(createPriceHistory).toHaveBeenCalledWith({
      data: {
        retailerProductId: 'rp-1',
        price: 44.99,
      },
    });
  });

  it('marks listings out of stock when adapter availability says unavailable', async () => {
    findMany.mockResolvedValue([
      {
        id: 'rp-1',
        retailerName: 'Walmart',
        url: 'https://www.walmart.com/ip/123',
        inStock: true,
      },
    ]);
    fetchProduct.mockResolvedValue({ price: 22.5, availability: 'OutOfStock' });
    getRetailerDefinitionByName.mockReturnValue({
      adapter: class {
        fetchProduct = fetchProduct;
      },
    });

    await refreshRetailerPrices();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inStock: false,
        }),
      })
    );
  });

  it('skips unsupported retailer rows without failing the run', async () => {
    findMany.mockResolvedValue([
      {
        id: 'rp-1',
        retailerName: 'Unknown',
        url: 'https://example.com/product',
        inStock: true,
      },
    ]);
    getRetailerDefinitionByName.mockReturnValue(null);

    const summary = await refreshRetailerPrices();

    expect(summary).toEqual({ scanned: 1, refreshed: 0, failed: 0, skipped: 1 });
    expect(update).not.toHaveBeenCalled();
  });

  it('continues across batches when one adapter returns an invalid price', async () => {
    findMany.mockResolvedValue([
      {
        id: 'rp-1',
        retailerName: 'Amazon',
        url: 'https://www.amazon.com/dp/BADPRICE000',
        inStock: true,
      },
      {
        id: 'rp-2',
        retailerName: 'Amazon',
        url: 'https://www.amazon.com/dp/GOODPRICE1',
        inStock: true,
      },
    ]);
    fetchProduct.mockResolvedValueOnce({ price: 'N/A' }).mockResolvedValueOnce({ price: 15.25 });
    getRetailerDefinitionByName.mockReturnValue({
      adapter: class {
        fetchProduct = fetchProduct;
      },
    });

    const summary = await refreshRetailerPrices(1);

    expect(summary).toEqual({ scanned: 2, refreshed: 1, failed: 1, skipped: 0 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rp-2' },
        data: expect.objectContaining({ price: 15.25 }),
      })
    );
  });
});
