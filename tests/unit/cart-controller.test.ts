import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../apps/api/src/services/cartService', () => ({
  getOrCreateCart: jest.fn(),
  addItemToCart: jest.fn(),
  removeCartItem: jest.fn(),
  updateCartItemQuantity: jest.fn(),
  clearActiveCart: jest.fn(),
}));

import { buildCartGroups } from '../../apps/api/src/services/cartGroupingService';
import { normalizeCartItem } from '../../apps/api/src/controllers/cartController';

describe('cartController normalizeCartItem', () => {
  it('exposes selected match confidence fields on cart items', () => {
    const item = {
      id: 'cart-item-1',
      productId: 'product-1',
      sourceRetailer: 'Amazon',
      quantity: 1,
      product: {
        id: 'product-1',
        name: 'Wireless Headphones',
        attributes: null,
        retailerProducts: [
          {
            id: 'source-rp',
            retailerName: 'Amazon',
            retailerSku: 'amz-1',
            price: 139.99,
            shippingCost: 0,
            taxRate: 0.08,
            url: 'https://www.amazon.com/dp/AMZ1',
            inStock: true,
            lastUpdated: new Date('2026-05-06T12:00:00.000Z'),
          },
        ],
      },
      matchResults: [
        {
          id: 'match-1',
          retailerProductId: 'rp-1',
          matchType: 'substitute',
          confidenceScore: 0.62,
          isSelected: false,
        },
        {
          id: 'match-2',
          retailerProductId: 'rp-2',
          matchType: 'exact',
          confidenceScore: 0.96,
          isSelected: true,
          retailerProduct: {
            retailerName: 'Walmart',
            price: 129.99,
            url: 'https://www.walmart.com/ip/123',
          },
        },
      ],
    };

    expect(normalizeCartItem(item)).toMatchObject({
      duplicateGroupKey: 'product:product-1',
      matchType: 'exact',
      matchConfidence: 0.96,
      confidenceScore: 0.96,
      selectedRetailerProductId: 'rp-2',
      matchedRetailer: 'Walmart',
      matchedPrice: 129.99,
      matchedUrl: 'https://www.walmart.com/ip/123',
      sourceListing: {
        retailerName: 'Amazon',
        retailerSku: 'amz-1',
        price: 139.99,
        url: 'https://www.amazon.com/dp/AMZ1',
        inStock: true,
      },
      product: {
        attributes: undefined,
      },
    });
  });

  it('leaves match fields undefined when no match is selected', () => {
    const normalized = normalizeCartItem({
      id: 'cart-item-1',
      product: null,
      matchResults: [{ isSelected: false, confidenceScore: 0.7, matchType: 'similar' }],
    });

    expect(normalized.matchType).toBeUndefined();
    expect(normalized.matchConfidence).toBeUndefined();
    expect(normalized.selectedRetailerProductId).toBeUndefined();
  });

  it('groups duplicate cart items while preserving source listings and quantities', () => {
    const items = [
      normalizeCartItem({
        id: 'amazon-item',
        productId: 'product-1',
        sourceRetailer: 'Amazon',
        quantity: 1,
        product: {
          id: 'product-1',
          name: 'Northwind Hoodie',
          brand: 'Northwind',
          upc: '0-12345-67890-5',
          attributes: { color: 'Blue', size: 'M', variantKey: 'blue|m' },
          retailerProducts: [
            {
              retailerName: 'Amazon',
              retailerSku: 'hoodie-amz',
              url: 'https://amazon.example/hoodie',
              price: 49,
            },
          ],
        },
        matchResults: [],
      }),
      normalizeCartItem({
        id: 'target-item',
        productId: 'product-1',
        sourceRetailer: 'Target',
        quantity: 2,
        product: {
          id: 'product-1',
          name: 'Northwind Hoodie',
          brand: 'Northwind',
          upc: '012345678905',
          attributes: { color: 'Blue', size: 'M', variantKey: 'blue|m' },
          retailerProducts: [
            {
              retailerName: 'Target',
              retailerSku: 'hoodie-tgt',
              url: 'https://target.example/hoodie',
              price: 47,
            },
          ],
        },
        matchResults: [{ isSelected: true }],
      }),
    ];

    const groups = buildCartGroups(items);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: 'upc:012345678905',
      title: 'Northwind Hoodie',
      totalQuantity: 3,
      sourceRetailers: ['Amazon', 'Target'],
      selectedMatchCount: 1,
      sourceListings: [
        {
          cartItemId: 'amazon-item',
          sourceRetailer: 'Amazon',
          retailerSku: 'hoodie-amz',
          quantity: 1,
        },
        {
          cartItemId: 'target-item',
          sourceRetailer: 'Target',
          retailerSku: 'hoodie-tgt',
          quantity: 2,
        },
      ],
    });
  });

  it('keeps different variants in separate duplicate groups when UPC is unavailable', () => {
    const groups = buildCartGroups([
      normalizeCartItem({
        id: 'blue',
        productId: 'canonical-shirt',
        sourceRetailer: 'Shopify',
        quantity: 1,
        product: {
          id: 'canonical-shirt',
          name: 'Northwind Shirt',
          attributes: { color: 'Blue', size: 'M', variantKey: 'blue|m' },
        },
        matchResults: [],
      }),
      normalizeCartItem({
        id: 'red',
        productId: 'canonical-shirt',
        sourceRetailer: 'Shopify',
        quantity: 1,
        product: {
          id: 'canonical-shirt',
          name: 'Northwind Shirt',
          attributes: { color: 'Red', size: 'M', variantKey: 'red|m' },
        },
        matchResults: [],
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.key).sort()).toEqual([
      'product:canonical-shirt:variant:blue m',
      'product:canonical-shirt:variant:red m',
    ]);
  });
});
