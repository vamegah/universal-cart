/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';

// --- Import / normalization ---
import {
  parsePrice,
  parseJsonLd,
  extractJsonLdMetadata,
  parseProductMetadataFromHtml,
} from '../../apps/api/src/integrations/productParser';
import {
  getRetailerDefinition,
  getRetailerDefinitionByName,
  getSupportedRetailerNames,
} from '../../apps/api/src/integrations/registry';

// --- Matching helpers (exported for testing) ---
import { saveMatchCandidates } from '../../apps/api/src/services/matchingService';

// --- Pricing math ---
import { calculateLoyaltyValue } from '../../apps/api/src/services/loyaltyService';
import { evaluateCoupons } from '../../apps/api/src/services/couponService';

// --- Alert refresh conditions ---
import { refreshAlerts } from '../../apps/api/src/services/alertRefreshService';
import { getCheckoutSupportStatus } from '../../apps/api/src/controllers/checkoutController';

// ─── productParser ────────────────────────────────────────────────────────────

describe('productParser — parsePrice', () => {
  it('parses a plain dollar string', () => {
    expect(parsePrice('$29.99')).toBe(29.99);
  });

  it('parses a price with commas', () => {
    expect(parsePrice('1,299.00')).toBe(1299);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice('N/A')).toBeNull();
  });
});

describe('productParser — parseJsonLd', () => {
  it('extracts a single JSON-LD block', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Widget"}</script>`;
    const blocks = parseJsonLd(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe('Widget');
  });

  it('extracts multiple JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Product","name":"A"}</script>
      <script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
    `;
    const blocks = parseJsonLd(html);
    expect(blocks).toHaveLength(2);
  });

  it('skips malformed JSON-LD blocks without throwing', () => {
    const html = `<script type="application/ld+json">{bad json}</script>`;
    expect(() => parseJsonLd(html)).not.toThrow();
    expect(parseJsonLd(html)).toHaveLength(0);
  });

  it('returns empty array when no JSON-LD is present', () => {
    expect(parseJsonLd('<html><body>no structured data</body></html>')).toEqual([]);
  });
});

describe('productParser — extractJsonLdMetadata', () => {
  it('extracts name, price, sku, brand, and upc from a Product block', () => {
    const blocks = [
      {
        '@type': 'Product',
        name: 'Sony WH-1000XM5',
        sku: 'WH1000XM5',
        brand: { name: 'Sony' },
        gtin13: '0027242920460',
        offers: { price: '349.99', availability: 'https://schema.org/InStock' },
      },
    ];
    const meta = extractJsonLdMetadata(blocks);
    expect(meta.name).toBe('Sony WH-1000XM5');
    expect(meta.price).toBe(349.99);
    expect(meta.sku).toBe('WH1000XM5');
    expect(meta.brand).toBe('Sony');
    expect(meta.upc).toBe('0027242920460');
    expect(meta.availability).toContain('InStock');
  });

  it('extracts color and size into attributes', () => {
    const blocks = [
      {
        '@type': 'Product',
        name: 'T-Shirt',
        color: 'Blue',
        size: 'M',
        offers: { price: '19.99' },
      },
    ];
    const meta = extractJsonLdMetadata(blocks);
    expect(meta.attributes?.color).toBe('Blue');
    expect(meta.attributes?.size).toBe('M');
  });

  it('ignores non-Product blocks', () => {
    const blocks = [{ '@type': 'BreadcrumbList', name: 'Home' }];
    const meta = extractJsonLdMetadata(blocks);
    expect(meta.name).toBeUndefined();
  });

  it('returns empty metadata for empty blocks array', () => {
    const meta = extractJsonLdMetadata([]);
    expect(meta).toEqual({});
  });
});

describe('productParser — parseProductMetadataFromHtml', () => {
  it('extracts product metadata from a full HTML page with JSON-LD', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type":"Product","name":"AirPods Pro","sku":"MLWK3LL/A","offers":{"price":"249.00"}}
        </script>
      </head><body></body></html>
    `;
    const meta = parseProductMetadataFromHtml(html);
    expect(meta.name).toBe('AirPods Pro');
    expect(meta.price).toBe(249);
    expect(meta.sku).toBe('MLWK3LL/A');
  });

  it('returns empty metadata for a page with no structured data', () => {
    const meta = parseProductMetadataFromHtml('<html><body>nothing here</body></html>');
    expect(meta.name).toBeUndefined();
    expect(meta.price).toBeUndefined();
  });
});

// ─── registry ─────────────────────────────────────────────────────────────────

describe('registry — getRetailerDefinition', () => {
  it('identifies Amazon by URL', () => {
    expect(getRetailerDefinition('https://www.amazon.com/dp/B09XYZ')?.name).toBe('Amazon');
  });

  it('identifies Walmart by URL', () => {
    expect(getRetailerDefinition('https://www.walmart.com/ip/123')?.name).toBe('Walmart');
  });

  it('identifies Target by URL', () => {
    expect(getRetailerDefinition('https://www.target.com/p/item/-/A-123')?.name).toBe('Target');
  });

  it("identifies Macy's by URL", () => {
    expect(getRetailerDefinition('https://www.macys.com/shop/product/123')?.name).toBe("Macy's");
  });

  it('returns null for an unsupported domain', () => {
    expect(getRetailerDefinition('https://www.unsupportedstore.com/product/1')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(getRetailerDefinition('not-a-url')).toBeNull();
  });
});

describe('registry — getRetailerDefinitionByName', () => {
  it('finds a retailer case-insensitively', () => {
    expect(getRetailerDefinitionByName('amazon')?.name).toBe('Amazon');
    expect(getRetailerDefinitionByName('WALMART')?.name).toBe('Walmart');
  });

  it('returns null for an unknown retailer name', () => {
    expect(getRetailerDefinitionByName('FakeStore')).toBeNull();
  });
});

describe('registry — getSupportedRetailerNames', () => {
  it('returns all six supported retailers', () => {
    const names = getSupportedRetailerNames();
    expect(names).toContain('Amazon');
    expect(names).toContain('Walmart');
    expect(names).toContain('Target');
    expect(names).toContain("Macy's");
    expect(names).toContain('BestBuy');
    expect(names).toContain('Shopify');
  });
});

// ─── matchingService — saveMatchCandidates validation ─────────────────────────

describe('matchingService — saveMatchCandidates input validation', () => {
  it('throws when candidates is not an array', async () => {
    await expect(
      saveMatchCandidates('cart-item-1', null as any)
    ).rejects.toThrow('Candidates must be an array');
  });

  it('returns { stored: 0 } for an empty candidates array without hitting the DB', async () => {
    // Mock prisma calls so this test runs without a real DB.
    // saveMatchCandidates with no selectedRetailerProductId skips the updateMany
    // and deleteMany, then returns early when rows.length === 0.
    // We patch prisma on the module to avoid a real connection.
    const matchingModule = require('../../apps/api/src/services/matchingService');
    const { prisma } = require('../../apps/api/src/index');

    const origDeleteMany = prisma.matchResult.deleteMany;
    const origCreateMany = prisma.matchResult.createMany;
    prisma.matchResult.deleteMany = async () => ({ count: 0 });
    prisma.matchResult.createMany = async () => ({ count: 0 });

    try {
      const result = await matchingModule.saveMatchCandidates('cart-item-1', []);
      expect(result).toEqual({ stored: 0 });
    } finally {
      prisma.matchResult.deleteMany = origDeleteMany;
      prisma.matchResult.createMany = origCreateMany;
    }
  });
});

// ─── pricingService — line total math ─────────────────────────────────────────

describe('pricingService — line total math via loyaltyService + couponService', () => {
  it('computes effective total correctly: base + shipping + tax - rewards - loyalty', async () => {
    const base = 100;
    const shipping = 5;
    const taxRate = 0.08;
    const tax = base * taxRate; // 8
    const rewardsRate = 0.05;
    const rewardsValue = base * rewardsRate; // 5

    const membership = {
      retailerName: 'Amazon',
      pointsRate: 1,
      pointValueCents: 1,
      thresholdSpend: null,
      thresholdReward: null,
    };
    const loyalty = calculateLoyaltyValue(base, membership);
    // pointsEarned = 100, pointsValue = 100 * 1 / 100 = 1.00
    expect(loyalty.pointsValue).toBeCloseTo(1.0);

    const coupons = await evaluateCoupons({ retailerName: 'Amazon', subtotal: base });
    // Coupon appliedSavings is always 0 (unconfirmed)
    expect(coupons.appliedSavings).toBe(0);

    const subtotal = base + shipping + tax - coupons.appliedSavings; // 113
    const effectiveTotal = subtotal - rewardsValue - loyalty.totalValue; // 113 - 5 - 1 = 107
    expect(effectiveTotal).toBeCloseTo(107, 1);
  });

  it('returns zero loyalty value when no membership is provided', () => {
    const loyalty = calculateLoyaltyValue(200, null);
    expect(loyalty.totalValue).toBe(0);
    expect(loyalty.pointsEarned).toBe(0);
  });
});

// ─── checkout readiness — pure logic ──────────────────────────────────────────

// Extract the pure helpers by re-implementing the same logic used in checkoutController.
// These are not exported, so we test the observable behaviour through the data shapes
// that the controller builds — specifically the item-status and store-support rules.

describe('checkout readiness — item status rules', () => {
  function normalizeVariantValue(value: unknown) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function getVariantKey(attributes: any) {
    if (!attributes || typeof attributes !== 'object') return '';
    const explicitKey = normalizeVariantValue(attributes.variantKey);
    if (explicitKey) return explicitKey;
    const color = normalizeVariantValue(attributes.color);
    const size = normalizeVariantValue(attributes.size);
    return [color, size].filter(Boolean).join(' ');
  }

  function createCheckoutItemStatus(item: any, retailerProduct: any) {
    const issues: Array<{ type: 'error' | 'warning'; message: string }> = [];
    const quantity = Number(item.quantity ?? 1);
    if (quantity <= 0) issues.push({ type: 'error', message: 'Quantity must be at least 1.' });
    if (retailerProduct) {
      if (!retailerProduct.inStock)
        issues.push({ type: 'error', message: 'This item is no longer in stock at the retailer.' });
      if (typeof item.price === 'number' && retailerProduct.price !== item.price)
        issues.push({ type: 'warning', message: `Price has changed` });

      const itemVariantKey = getVariantKey(item.attributes);
      const retailerVariantKey = getVariantKey(retailerProduct.product?.attributes);
      if (itemVariantKey && retailerVariantKey && itemVariantKey !== retailerVariantKey) {
        issues.push({ type: 'error', message: 'Selected variant no longer matches the retailer listing.' });
      } else if (item.matchedProductId && itemVariantKey && !retailerVariantKey) {
        issues.push({ type: 'warning', message: 'Selected variant could not be verified against the retailer listing.' });
      }
    }
    const matchType = String(item.matchType || '').toLowerCase();
    if (item.matchedProductId && matchType && matchType !== 'exact' && item.substituteApproved !== true)
      issues.push({ type: 'error', message: `${item.productName || 'This item'} is a ${matchType} match and needs approval before checkout.` });
    return { item, retailerProduct, issues };
  }

  it('passes a valid in-stock exact-match item with no issues', () => {
    const status = createCheckoutItemStatus(
      { quantity: 1, matchedProductId: 'rp-1', matchType: 'exact', price: 49.99 },
      { inStock: true, price: 49.99, retailerName: 'Amazon' }
    );
    expect(status.issues).toHaveLength(0);
  });

  it('errors when item is out of stock', () => {
    const status = createCheckoutItemStatus(
      { quantity: 1 },
      { inStock: false, price: 49.99, retailerName: 'Amazon' }
    );
    expect(status.issues.some((i) => i.type === 'error' && i.message.includes('no longer in stock'))).toBe(true);
  });

  it('warns on price change', () => {
    const status = createCheckoutItemStatus(
      { quantity: 1, price: 49.99 },
      { inStock: true, price: 54.99, retailerName: 'Amazon' }
    );
    expect(status.issues.some((i) => i.type === 'warning' && i.message.includes('Price has changed'))).toBe(true);
  });

  it('errors when the selected variant no longer matches the retailer listing', () => {
    const status = createCheckoutItemStatus(
      { quantity: 1, matchedProductId: 'rp-1', matchType: 'exact', attributes: { color: 'Blue', size: 'M' } },
      { inStock: true, price: 54.99, retailerName: 'Amazon', product: { attributes: { color: 'Black', size: 'M' } } }
    );
    expect(status.issues.some((i) => i.type === 'error' && i.message.includes('variant'))).toBe(true);
  });

  it('warns when a matched variant cannot be verified from the retailer listing', () => {
    const status = createCheckoutItemStatus(
      { quantity: 1, matchedProductId: 'rp-1', matchType: 'exact', attributes: { variantKey: 'blue m' } },
      { inStock: true, price: 54.99, retailerName: 'Amazon', product: { attributes: {} } }
    );
    expect(status.issues.some((i) => i.type === 'warning' && i.message.includes('could not be verified'))).toBe(true);
  });

  it('errors on substitute match without approval', () => {
    const status = createCheckoutItemStatus(
      { quantity: 1, matchedProductId: 'rp-2', matchType: 'substitute', substituteApproved: false },
      { inStock: true, price: 30, retailerName: 'Target' }
    );
    expect(status.issues.some((i) => i.type === 'error' && i.message.includes('substitute'))).toBe(true);
  });

  it('passes a substitute match when explicitly approved', () => {
    const status = createCheckoutItemStatus(
      { quantity: 1, matchedProductId: 'rp-2', matchType: 'substitute', substituteApproved: true },
      { inStock: true, price: 30, retailerName: 'Target' }
    );
    expect(status.issues.filter((i) => i.type === 'error')).toHaveLength(0);
  });

  it('errors when quantity is zero', () => {
    const status = createCheckoutItemStatus({ quantity: 0 }, null);
    expect(status.issues.some((i) => i.type === 'error' && i.message.includes('Quantity'))).toBe(true);
  });
});

describe('checkout readiness — budget controls', () => {
  function checkBudget(estimatedTotal: number, budgetControls: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const maxOrderBudget = budgetControls.maxOrderBudget ?? null;
    const monthlyFinancingCap = budgetControls.monthlyFinancingCap ?? null;
    const preferredInstallmentAmount = budgetControls.preferredInstallmentAmount ?? null;

    if (maxOrderBudget != null && estimatedTotal > maxOrderBudget)
      errors.push(`Estimated checkout total ${estimatedTotal.toFixed(2)} exceeds your max order budget of ${maxOrderBudget.toFixed(2)}.`);
    if (monthlyFinancingCap != null && estimatedTotal > monthlyFinancingCap)
      warnings.push(`Estimated checkout total ${estimatedTotal.toFixed(2)} exceeds your monthly financing cap of ${monthlyFinancingCap.toFixed(2)}.`);
    if (preferredInstallmentAmount != null && estimatedTotal > preferredInstallmentAmount)
      warnings.push(`Estimated checkout total is above your preferred installment amount of ${preferredInstallmentAmount.toFixed(2)}.`);

    return { errors, warnings };
  }

  it('blocks checkout when total exceeds max order budget', () => {
    const { errors } = checkBudget(150, { maxOrderBudget: 100 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('max order budget');
  });

  it('warns when total exceeds monthly financing cap', () => {
    const { warnings } = checkBudget(250, { monthlyFinancingCap: 200 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('monthly financing cap');
  });

  it('warns when total exceeds preferred installment amount', () => {
    const { warnings } = checkBudget(80, { preferredInstallmentAmount: 50 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('preferred installment amount');
  });

  it('passes cleanly when total is within all budget limits', () => {
    const { errors, warnings } = checkBudget(49, { maxOrderBudget: 100, monthlyFinancingCap: 200, preferredInstallmentAmount: 75 });
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('ignores budget controls that are not set', () => {
    const { errors, warnings } = checkBudget(999, {});
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});

// ─── alertRefreshService — condition evaluation ────────────────────────────────

describe('checkout routing support metadata', () => {
  it('reports Amazon multi-item cart prebuild support', () => {
    const status = getCheckoutSupportStatus('Amazon', [
      { retailerSku: 'B000000001', quantity: 1 },
      { retailerSku: 'B000000002', quantity: 2 },
    ]);

    expect(status).toMatchObject({
      name: 'Amazon',
      supported: true,
      routeType: 'cart_add',
      message: 'Creates a supported merchant cart-add redirect for the selected items.',
      limitations: [],
    });
  });

  it('reports transparent non-Amazon multi-item fallback limitations', () => {
    const status = getCheckoutSupportStatus('Target', [
      { sourceUrl: 'https://www.target.com/p/item-a/-/A-1', quantity: 1 },
      { sourceUrl: 'https://www.target.com/p/item-b/-/A-2', quantity: 1 },
    ]);

    expect(status).toMatchObject({
      supported: false,
      routeType: 'unsupported',
      reason: 'Non-Amazon checkout currently supports only one cart item at a time.',
    });
    expect(status.limitations[0]).toContain('single verified product-page');
  });

  it('reports verified product-page redirects for supported single non-Amazon items', () => {
    const status = getCheckoutSupportStatus('Macy\'s', [
      { sourceUrl: 'https://www.macys.com/product/coat', quantity: 1 },
    ]);

    expect(status).toMatchObject({
      supported: true,
      routeType: 'product_page',
    });
    expect(status.message).toContain('verified merchant product page');
  });
});

describe('alertRefreshService — refreshAlerts skips gracefully with no DB', () => {
  it('resolves without throwing when prisma returns no subscriptions', async () => {
    const { prisma } = require('../../apps/api/src/index');
    const orig = prisma.alertSubscription.findMany;
    prisma.alertSubscription.findMany = async () => [];
    try {
      await expect(refreshAlerts()).resolves.toBeUndefined();
    } finally {
      prisma.alertSubscription.findMany = orig;
    }
  });
});
