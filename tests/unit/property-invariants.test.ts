/**
 * @jest-environment node
 */

import { afterEach, describe, expect, it } from '@jest/globals';
import { parsePrice, safeMatch } from '../../apps/api/src/integrations/productParser';
import { gatherCandidates } from '../../apps/api/src/services/matchingService';
import { prisma } from '../../apps/api/src/index';

const generatedTextInputs = [
  '$0.00',
  '$1.23',
  'USD 12.99',
  '1,299.00',
  '1.299,00',
  'free',
  'N/A',
  '-$12.00',
  'save 20% today',
  'price: 999999.99',
  '€49,95',
  'abc123def',
];

describe('productParser property invariants', () => {
  it('parsePrice never returns a negative number for non-empty string input', () => {
    for (const input of generatedTextInputs) {
      const parsed = parsePrice(input);
      expect(parsed === null || parsed >= 0).toBe(true);
    }
  });

  it('safeMatch returns null or a non-empty string', () => {
    const cases = [
      { html: '<span data-price="$12.99">', pattern: /data-price="([^"]*)"/ },
      { html: '<span data-price="">', pattern: /data-price="([^"]*)"/ },
      { html: '<meta content="  Sony  ">', pattern: /content="([^"]*)"/ },
      { html: '<div>No match</div>', pattern: /sku="([^"]*)"/ },
    ];

    for (const { html, pattern } of cases) {
      const result = safeMatch(html, pattern);
      expect(result === null || result.length > 0).toBe(true);
    }
  });
});

describe('matchingService property invariants', () => {
  const retailerProductDelegate = prisma.retailerProduct as any;
  const originalFindFirst = retailerProductDelegate.findFirst;
  const originalFindMany = retailerProductDelegate.findMany;

  afterEach(() => {
    retailerProductDelegate.findFirst = originalFindFirst;
    retailerProductDelegate.findMany = originalFindMany;
  });

  it('candidate confidence is always in [0, 1]', async () => {
    const listings = [
      retailerProduct('rp-upc', 'Amazon', 'Exact UPC Widget', { upc: '000111222333', isAuthorizedSeller: true }),
      retailerProduct('rp-sku', 'Amazon', 'SKU Widget', { retailerSku: 'SKU-1', warrantySupport: true }),
      retailerProduct('rp-brand', 'Amazon', 'Acme Widget', { brand: 'Acme', customerRating: 4.8 }),
      retailerProduct('rp-category', 'Amazon', 'Category Widget', { category: 'audio', counterfeitRisk: 'medium' }),
      retailerProduct('rp-name', 'Amazon', 'Acme Noise Cancelling Headphones', {}),
    ];

    retailerProductDelegate.findFirst = async ({ where }: any) => {
      if (where?.product?.upc) return listings.find((listing) => listing.product.upc === where.product.upc) ?? null;
      if (where?.retailerSku) return listings.find((listing) => listing.retailerSku === where.retailerSku) ?? null;
      return null;
    };
    retailerProductDelegate.findMany = async ({ where }: any) => {
      if (where?.product?.brand && where?.product?.model) {
        return listings.filter(
          (listing) => listing.product.brand === where.product.brand && listing.product.model === where.product.model
        );
      }
      if (where?.product?.brand) return listings.filter((listing) => listing.product.brand === where.product.brand);
      if (where?.product?.model) return listings.filter((listing) => listing.product.model === where.product.model);
      if (where?.product?.category) return listings.filter((listing) => listing.product.category === where.product.category);
      if (where?.product?.name?.contains) {
        return listings.filter((listing) =>
          listing.product.name.toLowerCase().includes(String(where.product.name.contains).toLowerCase())
        );
      }
      if (where?.product?.name) return listings.filter((listing) => listing.product.name === where.product.name);
      return [];
    };

    const candidates = await gatherCandidates(
      {
        name: 'Acme Noise Cancelling Headphones',
        brand: 'Acme',
        model: 'NC-1',
        sku: 'SKU-1',
        upc: '000111222333',
        category: 'audio',
      },
      'Amazon'
    );

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.confidence).toBeGreaterThanOrEqual(0);
      expect(candidate.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('UPC matching outranks name-overlap matching for the same product', async () => {
    const upcListing = retailerProduct('rp-upc', 'Amazon', 'Acme Headphones', {
      upc: '000111222333',
      counterfeitRisk: 'low',
    });
    const nameListing = retailerProduct('rp-name', 'Amazon', 'Acme Basic Headphones', {
      counterfeitRisk: 'low',
    });

    retailerProductDelegate.findFirst = async ({ where }: any) => {
      if (where?.product?.upc) return upcListing;
      return null;
    };
    retailerProductDelegate.findMany = async ({ where }: any) => {
      if (where?.product?.name?.contains) return [nameListing];
      if (where?.product?.name === 'Acme Wireless Headphones') return [];
      return [];
    };

    const candidates = await gatherCandidates(
      {
        name: 'Acme Wireless Headphones',
        upc: '000111222333',
      },
      'Amazon'
    );

    const upcCandidate = candidates.find((candidate) => candidate.reason.includes('upc_match'));
    const nameCandidate = candidates.find((candidate) => candidate.reason.includes('name_overlap'));

    expect(upcCandidate).toBeDefined();
    expect(nameCandidate).toBeDefined();
    expect(upcCandidate!.confidence).toBeGreaterThan(nameCandidate!.confidence);
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
    sellerName: retailerName,
    isAuthorizedSeller: overrides.isAuthorizedSeller ?? false,
    warrantySupport: overrides.warrantySupport ?? false,
    returnWindowDays: 30,
    customerRating: overrides.customerRating ?? null,
    counterfeitRisk: overrides.counterfeitRisk ?? 'unknown',
    product: {
      name,
      brand: overrides.brand ?? null,
      model: overrides.model ?? null,
      upc: overrides.upc ?? null,
      category: overrides.category ?? null,
    },
  };
}
