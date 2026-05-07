/**
 * @jest-environment node
 */

import { afterEach, describe, expect, it } from '@jest/globals';
import { findMatchForProduct, gatherCandidates } from '../../apps/api/src/services/matchingService';
import { prisma } from '../../apps/api/src/index';

const retailerProductDelegate = prisma.retailerProduct as any;
const originalFindFirst = retailerProductDelegate.findFirst;
const originalFindMany = retailerProductDelegate.findMany;

afterEach(() => {
  retailerProductDelegate.findFirst = originalFindFirst;
  retailerProductDelegate.findMany = originalFindMany;
});

describe('matchingService candidate outcomes', () => {
  it('returns an exact UPC match with seller trust and normalized GTIN lookup', async () => {
    const listing = retailerProduct('target-upc', 'Target', 'Acme Speaker', {
      upc: '012345678905',
      isAuthorizedSeller: true,
      warrantySupport: true,
      counterfeitRisk: 'low',
      attributes: { color: 'Blue', size: 'M' },
    });

    retailerProductDelegate.findFirst = async ({ where }: any) => {
      if (where?.product?.upc === '012345678905') return listing;
      return null;
    };
    retailerProductDelegate.findMany = async () => [];

    const match = await findMatchForProduct(
      {
        name: 'Acme Speaker Blue M',
        upc: '0-12345-67890-5',
        attributes: { color: 'Blue', size: 'M' },
      },
      'Target'
    );

    expect(match).toMatchObject({
      matchType: 'exact',
      retailerProduct: {
        id: 'target-upc',
        sellerTrustLabel: 'strong',
      },
    });
    expect(match?.reason).toContain('upc_match');
    expect(match?.reason).toContain('variant_match');
  });

  it('returns close name/brand matches with explanation signals', async () => {
    const listing = retailerProduct('target-close', 'Target', 'Sony Noise Cancelling Headphones', {
      brand: 'Sony',
      customerRating: 4.6,
    });

    retailerProductDelegate.findFirst = async () => null;
    retailerProductDelegate.findMany = async ({ where }: any) => {
      if (where?.product?.brand === 'Sony') return [listing];
      if (where?.product?.name?.contains) return [listing];
      return [];
    };

    const match = await findMatchForProduct({ name: 'Sony Wireless Headphones', brand: 'Sony' }, 'Target');

    expect(match).toMatchObject({
      matchType: 'close',
      retailerProduct: { id: 'target-close' },
    });
    expect(match?.reason).toContain('name_overlap');
    expect(match?.reason).toContain('seller_trust_');
  });

  it('returns substitute category matches when stronger identifiers are absent', async () => {
    const listing = retailerProduct('target-substitute', 'Target', 'JBL Portable Speaker', {
      category: 'electronics',
      counterfeitRisk: 'medium',
    });

    retailerProductDelegate.findFirst = async () => null;
    retailerProductDelegate.findMany = async ({ where }: any) => {
      if (where?.product?.category === 'electronics') return [listing];
      return [];
    };

    const match = await findMatchForProduct({ name: 'Acme Bluetooth Speaker', category: 'electronics' }, 'Target');

    expect(match).toMatchObject({
      matchType: 'substitute',
      retailerProduct: { id: 'target-substitute' },
    });
    expect(match?.reason).toContain('category_match');
  });

  it('marks exact out-of-stock listings as unavailable instead of silently approving them', async () => {
    const listing = retailerProduct('target-unavailable', 'Target', 'Acme Speaker', {
      upc: '012345678905',
      inStock: false,
      isAuthorizedSeller: true,
    });

    retailerProductDelegate.findFirst = async ({ where }: any) => {
      if (where?.product?.upc === '012345678905') return listing;
      return null;
    };
    retailerProductDelegate.findMany = async () => [];

    const match = await findMatchForProduct({ name: 'Acme Speaker', upc: '012345678905' }, 'Target');

    expect(match).toMatchObject({
      matchType: 'unavailable',
      retailerProduct: { id: 'target-unavailable', inStock: false },
    });
    expect(match?.reason).toContain('unavailable');
  });

  it('downgrades conflicting variants so they do not outrank true variant matches', async () => {
    const blue = retailerProduct('blue-medium', 'Target', 'Northwind Hoodie', {
      brand: 'Northwind',
      model: 'Hoodie',
      attributes: { color: 'Blue', size: 'M', variantKey: 'blue|m' },
    });
    const red = retailerProduct('red-medium', 'Target', 'Northwind Hoodie', {
      brand: 'Northwind',
      model: 'Hoodie',
      attributes: { color: 'Red', size: 'M', variantKey: 'red|m' },
    });

    retailerProductDelegate.findFirst = async () => null;
    retailerProductDelegate.findMany = async ({ where }: any) => {
      if (where?.product?.brand === 'Northwind' && where?.product?.model === 'Hoodie') return [blue, red];
      if (where?.product?.name === 'Northwind Hoodie') return [blue, red];
      if (where?.product?.name?.contains) return [blue, red];
      return [];
    };

    const candidates = await gatherCandidates(
      {
        name: 'Northwind Hoodie',
        brand: 'Northwind',
        model: 'Hoodie',
        attributes: { color: 'Blue', size: 'M', variantKey: 'blue|m' },
      },
      'Target'
    );

    const blueMatch = candidates.find((candidate) => candidate.retailerProduct.id === 'blue-medium');
    const redMatch = candidates.find((candidate) => candidate.retailerProduct.id === 'red-medium');

    expect(blueMatch).toMatchObject({ matchType: 'exact' });
    expect(redMatch).toMatchObject({ matchType: 'substitute' });
    expect(blueMatch!.confidence).toBeGreaterThan(redMatch!.confidence);
    expect(redMatch!.reason).toContain('variant_mismatch');
  });

  it('uses visual similarity to improve recall while requiring review for visual-only substitutes', async () => {
    const visualCandidate = retailerProduct('visual-speaker', 'Target', 'Portable Blue Speaker', {
      category: 'electronics',
      imageUrl: 'https://cdn.example.com/products/blue-portable-speaker-front.jpg',
      attributes: { color: 'Blue', shape: 'portable' },
    });

    retailerProductDelegate.findFirst = async () => null;
    retailerProductDelegate.findMany = async ({ where }: any) => {
      if (where?.product?.category === 'electronics') return [visualCandidate];
      return [];
    };

    const match = await findMatchForProduct(
      {
        name: 'Acme Soundbox',
        category: 'electronics',
        imageUrl: 'https://images.example.com/acme/blue-portable-speaker-angle.jpg',
        attributes: { color: 'Blue', shape: 'portable' },
      },
      'Target'
    );

    expect(match).toMatchObject({
      matchType: 'substitute',
      retailerProduct: { id: 'visual-speaker' },
      reviewRequired: true,
    });
    expect(match?.reason).toContain('visual_similarity');
    expect(match?.reviewReason).toContain('review before approval');
    expect(match?.visualSimilarity).toBeGreaterThanOrEqual(0.42);
  });

  it('returns null when no candidate is available', async () => {
    retailerProductDelegate.findFirst = async () => null;
    retailerProductDelegate.findMany = async () => [];

    await expect(findMatchForProduct({ name: 'No Match Item' }, 'Target')).resolves.toBeNull();
  });
});

function retailerProduct(
  id: string,
  retailerName: string,
  name: string,
  overrides: {
    retailerSku?: string;
    brand?: string;
    model?: string;
    upc?: string;
    category?: string;
    imageUrl?: string;
    attributes?: Record<string, any>;
    inStock?: boolean;
    isAuthorizedSeller?: boolean;
    warrantySupport?: boolean;
    customerRating?: number;
    counterfeitRisk?: string;
  }
) {
  return {
    id,
    retailerName,
    retailerSku: overrides.retailerSku ?? id,
    price: 49.99,
    url: `https://${retailerName.toLowerCase()}.example/${id}`,
    inStock: overrides.inStock ?? true,
    sellerName: retailerName,
    isAuthorizedSeller: overrides.isAuthorizedSeller ?? false,
    warrantySupport: overrides.warrantySupport ?? false,
    returnWindowDays: 30,
    customerRating: overrides.customerRating ?? null,
    counterfeitRisk: overrides.counterfeitRisk ?? 'unknown',
    product: {
      id: `product-${id}`,
      name,
      brand: overrides.brand ?? null,
      model: overrides.model ?? null,
      upc: overrides.upc ?? null,
      category: overrides.category ?? null,
      imageUrl: overrides.imageUrl ?? null,
      attributes: overrides.attributes ?? null,
    },
  };
}
