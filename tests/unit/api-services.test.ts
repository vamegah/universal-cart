import { describe, expect, it } from '@jest/globals';
import { hashPassword, verifyPassword } from '../../apps/api/src/services/passwordService';
import { optimizeSplit, optimizeSplitPlan, ShippingThreshold } from '../../apps/api/src/services/splitOptimizerService';
import { evaluateCoupons } from '../../apps/api/src/services/couponService';
import { calculateSellerTrustScore, describeSellerTrust } from '../../apps/api/src/services/sellerTrustService';
import { summarizeGlobalAnalytics, summarizeUserAnalytics } from '../../apps/api/src/services/analyticsService';
import { optimizeShippingPlans } from '../../apps/api/src/services/shippingOptimizerService';
import { calculateLoyaltyValue, getLoyaltyMembership } from '../../apps/api/src/services/loyaltyService';
import { summarizeRetailerIntegrations } from '../../apps/api/src/services/adminRetailerService';
import { summarizeMatchReviewQueue } from '../../apps/api/src/services/adminMatchingService';
import { summarizeSellerTrustQueue } from '../../apps/api/src/services/adminSellerTrustService';
import { optionPassesRules, parseNaturalLanguageCartRules } from '../../apps/api/src/services/cartRulesService';

describe('passwordService', () => {
  it('hashes and verifies passwords without storing the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).not.toContain('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });
});

describe('splitOptimizerService', () => {
  it('assigns each item to the cheapest eligible user store', () => {
    const assignment = optimizeSplit(
      [
        { itemId: 'airpods', costs: { Amazon: 199, Target: 189, Walmart: 205 } },
        { itemId: 'coffee', costs: { Amazon: 18, Target: 21, Walmart: 16 } },
      ],
      ['Amazon', 'Target', 'Walmart']
    );

    expect(Object.fromEntries(assignment)).toEqual({
      airpods: 'Target',
      coffee: 'Walmart',
    });
  });

  it('falls back to the first user store when no costs are available', () => {
    const assignment = optimizeSplit([{ itemId: 'unknown', costs: {} }], ['Macy\'s', 'Amazon']);

    expect(assignment.get('unknown')).toBe('Macy\'s');
  });

  it('returns an explained plan using price, shipping, tax, rewards, and availability', () => {
    const plan = optimizeSplitPlan(
      [
        {
          itemId: 'coat',
          costs: {},
          options: {
            Amazon: { price: 100, shipping: 10, tax: 8, rewards: 0 },
            Target: { price: 105, shipping: 0, tax: 7, rewards: 10 },
            Walmart: { price: 90, shipping: 0, tax: 7, rewards: 0, available: false },
          },
        },
      ],
      ['Amazon', 'Target', 'Walmart']
    );

    expect(plan.assignments[0]).toMatchObject({
      itemId: 'coat',
      store: 'Target',
      totalCost: 102,
    });
    expect(plan.storeTotals.Target).toBe(102);
    expect(plan.unavailableItems).toEqual([]);
    expect(plan.thresholdSavings).toEqual({});
  });

  it('consolidates items to hit a free-shipping threshold when gap is within tolerance', () => {
    // Amazon has $28 subtotal, threshold is $35, gap is $7 (within default 20).
    // Item at Walmart costs $10 at Walmart, $12 at Amazon — delta $2 < shippingCost $8.
    // Optimizer should move it to Amazon to unlock free shipping.
    const plan = optimizeSplitPlan(
      [
        { itemId: 'book', costs: {}, options: { Amazon: { price: 28, shipping: 0, tax: 0, rewards: 0 } } },
        { itemId: 'pen',  costs: {}, options: { Walmart: { price: 10, shipping: 0, tax: 0, rewards: 0 }, Amazon: { price: 12, shipping: 0, tax: 0, rewards: 0 } } },
      ],
      ['Amazon', 'Walmart'],
      undefined,
      [{ store: 'Amazon', threshold: 35, shippingCost: 8, gapTolerance: 20 }] as ShippingThreshold[]
    );

    const penAssignment = plan.assignments.find((a) => a.itemId === 'pen');
    expect(penAssignment?.store).toBe('Amazon');
    expect(penAssignment?.reason).toContain('free-shipping threshold');
    expect(plan.thresholdSavings.Amazon).toBe(8);
  });

  it('does not consolidate when the gap exceeds tolerance', () => {
    const plan = optimizeSplitPlan(
      [
        { itemId: 'book', costs: {}, options: { Amazon: { price: 10, shipping: 0, tax: 0, rewards: 0 } } },
        { itemId: 'pen',  costs: {}, options: { Walmart: { price: 5, shipping: 0, tax: 0, rewards: 0 }, Amazon: { price: 6, shipping: 0, tax: 0, rewards: 0 } } },
      ],
      ['Amazon', 'Walmart'],
      undefined,
      [{ store: 'Amazon', threshold: 50, shippingCost: 8, gapTolerance: 10 }] as ShippingThreshold[]
    );

    // Gap is 34 — exceeds tolerance of 10, so pen stays at Walmart.
    const penAssignment = plan.assignments.find((a) => a.itemId === 'pen');
    expect(penAssignment?.store).toBe('Walmart');
    expect(plan.thresholdSavings.Amazon).toBeUndefined();
  });

  it('applies saved return preferences when choosing split options', () => {
    const plan = optimizeSplitPlan(
      [
        {
          itemId: 'jacket',
          costs: {},
          options: {
            BargainMart: { price: 50, shipping: 0, tax: 0, rewards: 0, returnWindowDays: 7, finalSale: true },
            Target: { price: 60, shipping: 0, tax: 0, rewards: 0, returnWindowDays: 30 },
          },
        },
      ],
      ['BargainMart', 'Target'],
      undefined,
      undefined,
      { shippingPref: { returnPreferences: { minReturnWindowDays: 30, avoidFinalSale: true } } }
    );

    expect(plan.assignments[0]).toMatchObject({
      itemId: 'jacket',
      store: 'Target',
      totalCost: 60,
    });
  });
});

describe('couponService', () => {
  it('reports estimated coupon savings without applying unconfirmed discounts', async () => {
    const result = await evaluateCoupons({
      retailerName: 'Target',
      subtotal: 120,
      category: 'electronics',
    });

    expect(result.estimatedSavings).toBeGreaterThan(0);
    expect(result.appliedSavings).toBe(0);
    expect(result.confirmed).toBe(false);
    expect(result.note).toContain('not included in effective totals');
  });
});

describe('sellerTrustService', () => {
  it('scores authorized listings with return and warranty support higher than risky sellers', () => {
    const trusted = calculateSellerTrustScore({
      isAuthorizedSeller: true,
      returnWindowDays: 30,
      warrantySupport: true,
      customerRating: 4.7,
      counterfeitRisk: 'low',
    });
    const risky = calculateSellerTrustScore({
      isAuthorizedSeller: false,
      returnWindowDays: 0,
      warrantySupport: false,
      customerRating: 2.8,
      counterfeitRisk: 'high',
    });

    expect(trusted).toBeGreaterThan(85);
    expect(risky).toBeLessThan(30);
  });

  it('returns display-ready trust labels and signals', () => {
    const trust = describeSellerTrust({
      isAuthorizedSeller: true,
      returnWindowDays: 30,
      warrantySupport: true,
      counterfeitRisk: 'low',
    });

    expect(trust.label).toBe('strong');
    expect(trust.signals).toContain('authorized seller');
    expect(trust.signals).toContain('30-day returns');
  });
});

describe('analyticsService', () => {
  it('summarizes audit events and cart state into MVP KPIs', () => {
    const summary = summarizeUserAnalytics(
      [
        { action: 'product.imported', createdAt: '2026-04-29T10:00:00.000Z', metadata: { sourceRetailer: 'Amazon' } },
        { action: 'product.imported', createdAt: '2026-04-29T10:10:00.000Z', metadata: { sourceRetailer: 'Target' } },
        { action: 'match.generated', createdAt: '2026-04-29T10:15:00.000Z' },
        { action: 'match.not_found', createdAt: '2026-04-29T10:16:00.000Z' },
        { action: 'checkout.validated', createdAt: '2026-04-29T10:20:00.000Z' },
        { action: 'checkout.financing_options_viewed', createdAt: '2026-04-29T10:20:30.000Z' },
        { action: 'checkout.redirect_created', createdAt: '2026-04-29T10:21:00.000Z' },
      ],
      [
        {
          status: 'active',
          splitPlans: [{ id: 'split-plan-1' }],
          items: [
            { quantity: 2, sourceRetailer: 'Amazon', matchResults: [{ isSelected: true }] },
            { quantity: 1, sourceRetailer: 'Target', matchResults: [] },
          ],
        },
      ],
      [{ financingTerms: { apr: 0, termMonths: 6 } }]
    );

    expect(summary.kpis.cartImportCount).toBe(2);
    expect(summary.kpis.matchAccuracy).toBe(0.5);
    expect(summary.kpis.checkoutCompletionRate).toBe(1);
    expect(summary.kpis.financingUtilizationRate).toBe(1);
    expect(summary.kpis.splitCartAdoptionRate).toBe(1);
    expect(summary.kpis.cartItemCount).toBe(3);
    expect(summary.kpis.matchedCartItemCount).toBe(1);
    expect(summary.kpis.financingEligibleCardCount).toBe(1);
    expect(summary.breakdowns.importedRetailers).toEqual({ Amazon: 1, Target: 1 });
  });

  it('summarizes global KPIs for admin analytics', () => {
    const summary = summarizeGlobalAnalytics(
      [
        { userId: 'user-1', action: 'product.imported', createdAt: '2026-04-29T10:00:00.000Z' },
        { userId: 'user-1', action: 'checkout.validated', createdAt: '2026-04-29T10:20:00.000Z' },
        { userId: 'user-1', action: 'checkout.redirect_created', createdAt: '2026-04-29T10:21:00.000Z' },
        { userId: 'user-2', action: 'checkout.financing_options_viewed', createdAt: '2026-04-30T10:21:00.000Z' },
      ],
      [
        { id: 'cart-1', userId: 'user-1', status: 'active', splitPlans: [{ id: 'split-1' }], items: [] },
        { id: 'cart-2', userId: 'user-2', status: 'converted', splitPlans: [], items: [] },
      ],
      [{ financingTerms: { apr: 0 } }, { financingTerms: null }],
      [
        { id: 'user-1', createdAt: '2026-04-29T00:00:00.000Z' },
        { id: 'user-2', createdAt: '2026-04-30T00:00:00.000Z' },
      ]
    );

    expect(summary.kpis.totalUsers).toBe(2);
    expect(summary.kpis.dailyActiveUsers).toBe(2);
    expect(summary.kpis.splitPlanCount).toBe(1);
    expect(summary.kpis.splitCartAdoptionRate).toBe(0.5);
    expect(summary.kpis.checkoutCompletionRate).toBe(1);
    expect(summary.kpis.financingEligibleCardCount).toBe(1);
  });
});

describe('shippingOptimizerService', () => {
  it('compares cost, package consolidation, and fastest delivery plans', () => {
    const result = optimizeShippingPlans([
      {
        itemId: 'coffee',
        quantity: 1,
        options: [
          { store: 'Amazon', price: 20, shipping: 8, etaDays: 2 },
          { store: 'Target', price: 22, shipping: 0, etaDays: 4, pickupAvailable: true },
        ],
      },
      {
        itemId: 'soap',
        quantity: 1,
        options: [
          { store: 'Amazon', price: 11, shipping: 8, etaDays: 2 },
          { store: 'Target', price: 12, shipping: 0, etaDays: 4, pickupAvailable: true },
        ],
      },
    ]);

    const costFirst = result.plans.find((plan) => plan.name === 'cost_first');
    const fastest = result.plans.find((plan) => plan.name === 'fastest_delivery');
    const fewest = result.plans.find((plan) => plan.name === 'fewest_packages');

    expect(costFirst?.totalCost).toBe(34);
    expect(fastest?.assignments.every((assignment) => assignment.store === 'Amazon')).toBe(true);
    expect(fewest?.storeCount).toBe(1);
    expect(result.recommendation).toBe('cost_first');
  });
});

describe('loyaltyService', () => {
  it('finds retailer memberships and monetizes points plus threshold offers', () => {
    const preferences = {
      shippingPref: {
        loyaltyMemberships: [
          {
            retailerName: 'Target',
            pointsRate: 2,
            pointValueCents: 1.5,
            thresholdSpend: 100,
            thresholdReward: 10,
          },
        ],
      },
    };

    const membership = getLoyaltyMembership(preferences, 'target');
    const value = calculateLoyaltyValue(120, membership);

    expect(membership?.retailerName).toBe('Target');
    expect(value.pointsEarned).toBe(240);
    expect(value.pointsValue).toBeCloseTo(3.6);
    expect(value.thresholdValue).toBe(10);
    expect(value.totalValue).toBeCloseTo(13.6);
  });
});

describe('adminRetailerService', () => {
  it('summarizes retailer adapter health and catalog counts', () => {
    const summary = summarizeRetailerIntegrations(
      [
        { name: 'Amazon', domains: ['amazon.com'], adapter: function Adapter() {} },
        { name: 'Target', domains: ['target.com'], adapter: null },
      ],
      [{ retailerName: 'Amazon', _count: { _all: 4 } }]
    );

    expect(summary[0]).toMatchObject({
      name: 'Amazon',
      adapterConfigured: true,
      catalogListingCount: 4,
      health: 'configured',
    });
    expect(summary[1]).toMatchObject({
      name: 'Target',
      adapterConfigured: false,
      catalogListingCount: 0,
      health: 'missing_adapter',
    });
  });

  it('overlays retailer integration management config onto health summaries', () => {
    const summary = summarizeRetailerIntegrations(
      [{ name: 'Amazon', domains: ['amazon.com'], adapter: function Adapter() {} }],
      [{ retailerName: 'Amazon', _count: { _all: 4 } }],
      [
        {
          retailerName: 'Amazon',
          pricingRefreshCadence: 'daily',
          catalogIngestionStatus: 'paused',
          affiliateMode: 'network_feed',
          affiliateId: 'aff-123',
          partnershipStatus: 'partnered',
          partnerContactEmail: 'partner@example.com',
          notes: 'Approved feed access',
          updatedAt: '2026-05-06T12:00:00.000Z',
        },
      ]
    );

    expect(summary[0]).toMatchObject({
      name: 'Amazon',
      pricingRefreshCadence: 'daily',
      catalogIngestionStatus: 'paused',
      affiliateMode: 'network_feed',
      affiliateId: 'aff-123',
      partnershipStatus: 'partnered',
      partnerContactEmail: 'partner@example.com',
      notes: 'Approved feed access',
      configUpdatedAt: '2026-05-06T12:00:00.000Z',
      health: 'paused',
    });
  });
});

describe('adminMatchingService', () => {
  it('summarizes low-confidence and substitute match review queues', () => {
    const summary = summarizeMatchReviewQueue([
      { matchType: 'exact', confidenceScore: 0.97 },
      { matchType: 'similar', confidenceScore: 0.74 },
      { matchType: 'substitute', confidenceScore: 0.83 },
    ]);

    expect(summary).toEqual({
      total: 3,
      lowConfidence: 1,
      substitutes: 1,
      exact: 1,
      rejected: 0,
    });
  });
});

describe('adminSellerTrustService', () => {
  it('summarizes risky seller listings for admin review', () => {
    const summary = summarizeSellerTrustQueue([
      {
        id: 'trusted',
        retailerName: 'Target',
        sellerName: 'Target',
        isAuthorizedSeller: true,
        warrantySupport: true,
        returnWindowDays: 30,
        counterfeitRisk: 'low',
      },
      {
        id: 'risk',
        retailerName: 'Marketplace',
        sellerName: 'Unknown seller',
        isAuthorizedSeller: false,
        warrantySupport: false,
        returnWindowDays: 0,
        counterfeitRisk: 'high',
      },
    ]);

    expect(summary).toEqual({
      total: 2,
      needsReview: 1,
      highRisk: 1,
      unverifiedSeller: 1,
    });
  });
});

describe('cartRulesService', () => {
  it('parses natural language cart rules and evaluates options', () => {
    const rules = parseNaturalLanguageCartRules(
      'Prefer exact matches only, only transfer beauty and fashion items, avoid third-party sellers, keep 2-day shipping and easy returns'
    );

    expect(rules).toMatchObject({
      version: 1,
      sourceText: expect.stringContaining('Prefer exact matches'),
      exactMatchesOnly: true,
      allowedCategories: ['beauty', 'fashion'],
      avoidThirdPartySellers: true,
      requireEasyReturns: true,
      maxEtaDays: 2,
    });
    expect(optionPassesRules({
      matchType: 'exact',
      category: 'beauty',
      isThirdPartySeller: false,
      returnWindowDays: 30,
      etaDays: 2,
    }, rules)).toBe(true);
    expect(optionPassesRules({
      matchType: 'substitute',
      category: 'electronics',
      isThirdPartySeller: true,
      returnWindowDays: 14,
      etaDays: 5,
    }, rules)).toBe(false);
  });

  it('explains rejected optimization options when cart rules are active', () => {
    const plan = optimizeSplitPlan(
      [
        {
          itemId: 'headphones',
          category: 'electronics',
          costs: {},
          options: {
            Amazon: { price: 100, matchType: 'exact', category: 'electronics', returnWindowDays: 30 },
            Marketplace: { price: 80, matchType: 'substitute', category: 'electronics', isThirdPartySeller: true, returnWindowDays: 7 },
          },
        },
      ],
      ['Amazon', 'Marketplace'],
      { exactMatchesOnly: true, avoidThirdPartySellers: true, requireEasyReturns: true }
    );

    expect(plan.assignments[0].store).toBe('Amazon');
    expect(plan.assignments[0].ruleRejections?.[0]).toMatchObject({
      store: 'Marketplace',
      violations: ['requires exact match', 'third-party seller blocked', 'return window below 30 days'],
    });
    expect(plan.assignments[0].ruleRejections?.[0].explanations[0].explanation).toContain('Rejected because');
  });
});
