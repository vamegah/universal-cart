import { describe, expect, it } from '@jest/globals';
import { upsertCartItem } from '../../apps/web/src/stores/cartStore';
import type { CartItem } from '../../apps/web/src/stores/cartStore';

function cartItem(overrides: Partial<CartItem>): CartItem {
  return {
    id: overrides.id || 'cart-item',
    productId: overrides.productId || 'product-1',
    sourceRetailer: overrides.sourceRetailer || 'Amazon',
    productName: overrides.productName || 'USB-C Charger',
    price: overrides.price ?? 29,
    quantity: overrides.quantity ?? 1,
    ...overrides,
  };
}

describe('cartStore upsertCartItem', () => {
  it('replaces an existing server cart item instead of duplicating it', () => {
    const items = [cartItem({ id: 'cart-item-1', quantity: 1, price: 29 })];

    const result = upsertCartItem(items, cartItem({ id: 'cart-item-1', quantity: 2, price: 27 }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'cart-item-1',
      quantity: 2,
      price: 27,
    });
  });

  it('merges the same product/source pair when the backend returns a new canonical item id', () => {
    const items = [cartItem({ id: 'local-temp', productId: 'product-1', sourceRetailer: 'Target', quantity: 1 })];

    const result = upsertCartItem(items, cartItem({ id: 'server-cart-item', productId: 'product-1', sourceRetailer: 'Target', quantity: 2 }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'server-cart-item',
      productId: 'product-1',
      sourceRetailer: 'Target',
      quantity: 2,
    });
  });
});
