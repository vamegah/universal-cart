/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';
import {
  getThresholdSuggestions,
  optimizeSplitPlan,
  optimizeSplitPlanGlobal,
  ShippingThreshold,
} from '../../apps/api/src/services/splitOptimizerService';
import { detectBundles } from '../../apps/api/src/services/bundleService';

describe('splitOptimizerService global optimization', () => {
  const stores = ['Amazon', 'Target'];
  const thresholds: ShippingThreshold[] = [
    { store: 'Amazon', threshold: 40, shippingCost: 10, gapTolerance: 20 },
  ];
  const cart = [
    {
      itemId: 'item-a',
      costs: {},
      options: {
        Amazon: { price: 20, shipping: 5, tax: 0, rewards: 0 },
        Target: { price: 18, shipping: 5, tax: 0, rewards: 0 },
      },
    },
    {
      itemId: 'item-b',
      costs: {},
      options: {
        Amazon: { price: 20, shipping: 5, tax: 0, rewards: 0 },
        Target: { price: 18, shipping: 5, tax: 0, rewards: 0 },
      },
    },
  ];

  it('finds a globally cheaper plan by considering shipping thresholds jointly', () => {
    const greedy = optimizeSplitPlan(cart, stores, undefined, thresholds);
    const global = optimizeSplitPlanGlobal(cart, stores, undefined, thresholds);

    expect(greedy.totalCost).toBe(46);
    expect(global.totalCost).toBe(40);
    expect(global.totalCost).toBeLessThanOrEqual(greedy.totalCost);
    expect(global.assignments.every((assignment) => assignment.store === 'Amazon')).toBe(true);
    expect(global.thresholdSavings.Amazon).toBe(10);
  });

  it('keeps every cart item assigned exactly once and totals internally consistent', () => {
    const cases = [
      { items: cart, thresholds },
      {
        items: [
          { itemId: 'book', costs: { Amazon: 11, Target: 9 } },
          { itemId: 'pen', costs: { Amazon: 4, Target: 5 } },
          { itemId: 'mug', costs: { Amazon: 7, Target: 6 } },
        ],
        thresholds: [],
      },
    ];

    for (const testCase of cases) {
      const plan = optimizeSplitPlanGlobal(testCase.items, stores, undefined, testCase.thresholds);
      const itemIds = plan.assignments.map((assignment) => assignment.itemId);
      const totalFromStores = Object.values(plan.storeTotals).reduce((sum, value) => sum + value, 0);

      expect(itemIds).toHaveLength(new Set(itemIds).size);
      expect(new Set(itemIds)).toEqual(new Set(testCase.items.map((item) => item.itemId)));
      expect(totalFromStores).toBeCloseTo(plan.totalCost);
    }
  });
});

describe('splitOptimizerService threshold suggestions', () => {
  it('suggests unlocks only when a store subtotal is within tolerance', () => {
    const nearPlan = optimizeSplitPlan(
      [{ itemId: 'soap', costs: {}, options: { Target: { price: 32, shipping: 6, tax: 0, rewards: 0 } } }],
      ['Target']
    );
    const farPlan = optimizeSplitPlan(
      [{ itemId: 'soap', costs: {}, options: { Target: { price: 10, shipping: 6, tax: 0, rewards: 0 } } }],
      ['Target']
    );
    const threshold = [{ store: 'Target', threshold: 35, shippingCost: 6, gapTolerance: 5 }];

    expect(getThresholdSuggestions(nearPlan, threshold)).toEqual([
      {
        store: 'Target',
        gap: 3,
        shippingCostSaved: 6,
        message: 'Add $3.00 at Target to unlock about $6.00 in shipping savings.',
      },
    ]);
    expect(getThresholdSuggestions(farPlan, threshold)).toEqual([]);
  });
});

describe('bundleService', () => {
  it('detects same-category retailer bundle offers below the individual best total', () => {
    const bundles = detectBundles(
      [
        { id: 'item-camera', productId: 'camera', quantity: 1, product: { name: 'Camera', category: 'electronics' } },
        { id: 'item-card', productId: 'memory-card', quantity: 1, product: { name: 'Memory Card', category: 'electronics' } },
      ],
      [
        { productId: 'camera', retailerName: 'Amazon', price: 100, inStock: true },
        { productId: 'memory-card', retailerName: 'Amazon', price: 80, inStock: true },
        { productId: 'camera', retailerName: 'BestBuy', price: 110, inStock: true, bundleId: 'camera-kit', bundlePrice: 150 },
        { productId: 'memory-card', retailerName: 'BestBuy', price: 90, inStock: true, bundleId: 'camera-kit', bundlePrice: 150 },
      ]
    );

    expect(bundles).toEqual([
      expect.objectContaining({
        category: 'electronics',
        retailerName: 'BestBuy',
        combinedPrice: 150,
        individualBestPrice: 180,
        savings: 30,
        itemIds: ['item-camera', 'item-card'],
      }),
    ]);
  });
});
