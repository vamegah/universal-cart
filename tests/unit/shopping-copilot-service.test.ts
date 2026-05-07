/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';
import {
  buildShoppingCopilotRecommendation,
  parseShoppingCopilotCommand,
} from '../../apps/api/src/services/shoppingCopilotService';

describe('shoppingCopilotService', () => {
  it('parses card-store transfer commands into confirmation-gated intent', () => {
    const parsed = parseShoppingCopilotCommand("move everything possible to stores where I can use my Macy's card", {
      supportedStores: ['Target', "Macy's"],
      userCards: [{ retailerName: "Macy's", cardLast4: '1234' }],
    });

    expect(parsed).toMatchObject({
      intent: 'recommend_transfers',
      targetStores: ["Macy's"],
      usesCardConstraint: true,
      requiresConfirmation: true,
    });
  });

  it('produces pending transfer recommendations without executing changes', () => {
    const recommendation = buildShoppingCopilotRecommendation({
      command: "move everything possible to stores where I can use my Macy's card",
      context: {
        supportedStores: ['Target', "Macy's"],
        userCards: [{ retailerName: "Macy's", cardLast4: '1234' }],
      },
      items: [
        {
          itemId: 'item-1',
          costs: { Target: 50, "Macy's": 42 },
          options: {
            "Macy's": {
              price: 42,
              available: true,
              matchType: 'exact',
              returnWindowDays: 30,
            },
          },
        },
      ],
    });

    expect(recommendation.requiresConfirmation).toBe(true);
    expect(recommendation.confirmation.irreversibleActions).toEqual([]);
    expect(recommendation.summary).toMatchObject({ pendingCount: 1, blockedCount: 0 });
    expect(recommendation.recommendations[0]).toMatchObject({
      itemId: 'item-1',
      store: "Macy's",
      action: 'transfer_item',
      status: 'pending_confirmation',
    });
  });

  it('blocks recommendations that violate parsed cart rules', () => {
    const recommendation = buildShoppingCopilotRecommendation({
      command: "move everything possible to Target, exact matches only",
      context: { supportedStores: ['Target'] },
      items: [
        {
          itemId: 'item-1',
          costs: { Target: 20 },
          options: {
            Target: {
              price: 20,
              available: true,
              matchType: 'substitute',
              returnWindowDays: 30,
            },
          },
        },
      ],
    });

    expect(recommendation.summary).toMatchObject({ pendingCount: 0, blockedCount: 1 });
    expect(recommendation.recommendations[0]).toMatchObject({
      action: 'manual_review',
      status: 'blocked',
      ruleViolations: ['requires exact match'],
    });
    expect(recommendation.confirmation.message).toContain('No automatic changes');
  });
});
