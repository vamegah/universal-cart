import { describe, expect, it } from '@jest/globals';
import { normalizeGtin, normalizeImportedProductData } from '../../apps/api/src/services/productNormalizationService';

describe('productNormalizationService', () => {
  it('normalizes GTIN and UPC values to digit-only identifiers', () => {
    expect(normalizeGtin(' 0-12345-67890-5 ')).toBe('012345678905');
    expect(normalizeGtin('978 0 306 40615 7')).toBe('9780306406157');
    expect(normalizeGtin('not-a-code')).toBeUndefined();
  });

  it('canonicalizes common variant text while preserving variant attributes', () => {
    const normalized = normalizeImportedProductData('Shopify', {
      name: 'Northwind Hoodie - Blue / M',
      price: 49.99,
      sku: 'hoodie-blue-m',
      sourceUrl: 'https://example.com/products/hoodie',
      brand: ' Northwind ',
      model: 'Blue / M',
      upc: ' 0-12345-67890-5 ',
      category: 'Apparel',
      attributes: {
        Colour: 'Blue',
      },
    });

    expect(normalized).toMatchObject({
      name: 'Northwind Hoodie',
      brand: 'Northwind',
      model: 'Blue / M',
      upc: '012345678905',
      category: 'fashion',
      attributes: {
        color: 'Blue',
        size: 'M',
        canonicalName: 'Northwind Hoodie',
        variantKey: 'blue|m',
      },
    });
    expect(normalized.rawMetadata).toMatchObject({
      retailerName: 'Shopify',
      sourceName: 'Northwind Hoodie - Blue / M',
      sourceUpc: ' 0-12345-67890-5 ',
    });
  });

  it('keeps explicit raw source metadata separate from normalized fields', () => {
    const rawMetadata = { jsonLd: { name: 'Sony Headphones' } };
    const normalized = normalizeImportedProductData('Best Buy', {
      name: 'Sony WH-1000XM5 Wireless Headphones',
      price: 299,
      sku: 'sony-xm5',
      sourceUrl: 'https://bestbuy.com/site/sony-xm5',
      brand: 'Sony',
      model: 'WH-1000XM5',
      category: 'Electronics',
      rawMetadata,
    });

    expect(normalized.rawMetadata).toBe(rawMetadata);
    expect(normalized.category).toBe('electronics');
    expect(normalized.attributes).toBeUndefined();
  });
});
