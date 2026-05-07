/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';
import {
  estimateRestockWindow,
  forecastPriceWindows,
  summarizePriceHistory,
} from '../../apps/api/src/services/pricePredictionService';
import { estimateLineTotal } from '../../apps/api/src/services/pricingService';

describe('pricingService invariants', () => {
  it('effectiveTotal never exceeds base + shipping + tax when rewards and loyalty are non-negative', async () => {
    const result = await estimateLineTotal(
      {
        id: 'rp-1',
        retailerName: 'Target',
        price: 100,
        shippingCost: 7,
        taxRate: 0.08,
        inStock: true,
        product: { category: 'electronics' },
      },
      2,
      0.05,
      { retailerName: 'Target', pointsRate: 2, pointValueCents: 1, thresholdSpend: 100, thresholdReward: 5 }
    );

    expect(result.effectiveTotal).toBeLessThanOrEqual(result.base + result.shipping + result.tax);
  });

  it('effectiveTotal is clamped at zero even when rewards exceed subtotal', async () => {
    const result = await estimateLineTotal(
      {
        id: 'rp-1',
        retailerName: 'Target',
        price: 20,
        shippingCost: 0,
        taxRate: 0,
        inStock: true,
        product: { category: 'home' },
      },
      1,
      2,
      { retailerName: 'Target', pointsRate: 100, pointValueCents: 100, thresholdSpend: 1, thresholdReward: 1000 }
    );

    expect(result.effectiveTotal).toBe(0);
  });

  it('estimateLineTotal is monotonically non-decreasing in quantity for positive costs without rewards', async () => {
    const retailerProduct = {
      id: 'rp-1',
      retailerName: 'Amazon',
      price: 15,
      shippingCost: 4,
      taxRate: 0.1,
      inStock: true,
      product: { category: 'books' },
    };

    const one = await estimateLineTotal(retailerProduct, 1, 0, null);
    const two = await estimateLineTotal(retailerProduct, 2, 0, null);
    const three = await estimateLineTotal(retailerProduct, 3, 0, null);

    expect(two.effectiveTotal).toBeGreaterThanOrEqual(one.effectiveTotal);
    expect(three.effectiveTotal).toBeGreaterThanOrEqual(two.effectiveTotal);
  });
});

describe('pricePredictionService', () => {
  it('summarizes price history trend statistics', () => {
    const trend = summarizePriceHistory([
      { price: 100, recordedAt: '2026-01-01T00:00:00.000Z' },
      { price: 90, recordedAt: '2026-01-11T00:00:00.000Z' },
      { price: 80, recordedAt: '2026-01-21T00:00:00.000Z' },
    ]);

    expect(trend).toMatchObject({
      slope: -1,
      min: 80,
      max: 100,
      average: 90,
      direction: 'falling',
    });
  });

  it('forecasts 7/14/30 day price windows with confidence', () => {
    const forecasts = forecastPriceWindows([
      { price: 100, recordedAt: '2026-01-01T00:00:00.000Z' },
      { price: 90, recordedAt: '2026-01-11T00:00:00.000Z' },
      { price: 80, recordedAt: '2026-01-21T00:00:00.000Z' },
    ]);

    expect(forecasts.map((forecast) => forecast.days)).toEqual([7, 14, 30]);
    expect(forecasts[0]).toMatchObject({
      predictedPrice: 73,
      expectedChange: -7,
      direction: 'falling',
    });
    expect(forecasts[0].confidence).toBeGreaterThan(0);
  });

  it('estimates restock window without presenting it as execution permission', () => {
    const estimate = estimateRestockWindow(
      { inStock: false, lastUpdated: '2026-01-21T00:00:00.000Z' },
      [
        { price: 100, recordedAt: '2026-01-01T00:00:00.000Z' },
        { price: 90, recordedAt: '2026-01-11T00:00:00.000Z' },
        { price: 80, recordedAt: '2026-01-21T00:00:00.000Z' },
      ]
    );

    expect(estimate).toMatchObject({
      status: 'out_of_stock',
      estimatedRestockAt: '2026-01-31T00:00:00.000Z',
      basis: expect.stringContaining('not used for auto-buy'),
    });
  });
});
