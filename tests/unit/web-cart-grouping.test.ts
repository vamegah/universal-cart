import { describe, expect, it } from '@jest/globals';
import { groupCartItems } from '../../apps/web/src/utils/cartGrouping';
import type { CartItem } from '../../apps/web/src/stores/cartStore';

function cartItem(overrides: Partial<CartItem>): CartItem {
  return {
    id: overrides.id || 'item',
    productName: overrides.productName || 'Apple AirPods Pro 2',
    sourceRetailer: overrides.sourceRetailer || 'Amazon',
    price: overrides.price ?? 199,
    quantity: overrides.quantity ?? 1,
    ...overrides,
  };
}

describe('cartGrouping', () => {
  it('groups equivalent items by UPC while preserving source listings', () => {
    const groups = groupCartItems([
      cartItem({ id: 'amazon', sourceRetailer: 'Amazon', upc: '12345', quantity: 1 }),
      cartItem({ id: 'target', sourceRetailer: 'Target', upc: '12345', quantity: 2 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].totalQuantity).toBe(3);
    expect(groups[0].sourceRetailers).toEqual(['Amazon', 'Target']);
    expect(groups[0].items.map((item) => item.id)).toEqual(['amazon', 'target']);
  });

  it('uses product id before title matching to avoid accidental grouping', () => {
    const groups = groupCartItems([
      cartItem({ id: 'a', productId: 'product-a', productName: 'USB-C Cable' }),
      cartItem({ id: 'b', productId: 'product-b', productName: 'USB-C Cable' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('tracks best positive effective savings in a group', () => {
    const groups = groupCartItems([
      cartItem({
        id: 'a',
        upc: 'saving',
        pricingComparison: {
          source: null,
          destination: { retailerName: 'Target', totalBeforeRewards: 90, effectiveTotal: 85, rewardsValue: 5 },
          recommendation: { cheaperDestination: true, effectiveSavings: 12.5, explanation: 'save' },
        },
      }),
      cartItem({
        id: 'b',
        upc: 'saving',
        pricingComparison: {
          source: null,
          destination: { retailerName: 'Walmart', totalBeforeRewards: 95, effectiveTotal: 94, rewardsValue: 1 },
          recommendation: { cheaperDestination: true, effectiveSavings: 4, explanation: 'save' },
        },
      }),
    ]);

    expect(groups[0].bestEffectiveSavings).toBe(12.5);
  });
});
