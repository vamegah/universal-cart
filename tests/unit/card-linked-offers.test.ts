/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';
import { optimizeSplitPlan } from '../../apps/api/src/services/splitOptimizerService';

describe('splitOptimizerService card-linked offer injection', () => {
  it('reroutes an item when an activated card-linked offer makes another store cheaper', () => {
    const preferences = {
      shippingPref: {
        cardLinkedOffers: [
          {
            retailerName: 'Target',
            description: '$25 back at Target',
            sourceName: 'Chase Offers',
            termsSummary: 'Valid on $100+ Target purchases',
            expiresAt: '2026-06-01',
            discountType: 'fixed',
            discountValue: 25,
            minSpend: 100,
            activated: true,
          },
        ],
      },
    };

    const plan = optimizeSplitPlan(
      [
        {
          itemId: 'headphones',
          costs: {},
          options: {
            Amazon: { price: 100, shipping: 0, tax: 0, rewards: 0 },
            Target: { price: 115, shipping: 0, tax: 0, rewards: 0 },
          },
        },
      ],
      ['Amazon', 'Target'],
      undefined,
      undefined,
      preferences
    );

    expect(plan.assignments[0]).toMatchObject({
      itemId: 'headphones',
      store: 'Target',
      totalCost: 90,
      breakdown: {
        price: 115,
        cardLinkedOffers: 25,
      },
    });
    expect(plan.assignments[0].reason).toContain('card-linked offer');
    expect(plan.assignments[0].cardLinkedOfferCitations?.[0]).toMatchObject({
      description: '$25 back at Target',
      sourceName: 'Chase Offers',
      termsSummary: 'Valid on $100+ Target purchases',
      expiresAt: '2026-06-01',
      expectedValue: 25,
    });
  });
});
