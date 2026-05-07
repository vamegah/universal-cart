/**
 * @jest-environment node
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFindMany = jest.fn<() => Promise<any[]>>();
const mockFindUnique = jest.fn<() => Promise<any>>();

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    userCard: {
      findMany: mockFindMany,
    },
    userPreferences: {
      findUnique: mockFindUnique,
    },
  },
}));

import { getFinancingOptions } from '../../apps/api/src/services/financingArbitrageService';

describe('financingArbitrageService', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
    mockFindUnique.mockResolvedValue(null);
  });

  it('models eligible APR costs and ranks by rewards-adjusted total', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'card-low-limit',
        retailerName: 'Target',
        cardLast4: '1111',
        rewardsRate: 0.01,
        financingTerms: { apr: 0, minPurchase: 100, creditLimit: 500, termMonths: 6 },
      },
      {
        id: 'card-high-apr',
        retailerName: 'Amazon',
        cardLast4: '2222',
        rewardsRate: 0.05,
        financingTerms: { apr: 12.99, minPurchase: 50, creditLimit: 5000, termMonths: 12 },
      },
      {
        id: 'card-too-small',
        retailerName: 'Macy\'s',
        cardLast4: '3333',
        rewardsRate: 0.02,
        financingTerms: { apr: 0, minPurchase: 800, creditLimit: 4000, termMonths: 12 },
      },
      {
        id: 'card-high-limit',
        retailerName: 'BestBuy',
        cardLast4: '4444',
        rewardsRate: 0.02,
        financingTerms: { apr: 0, minPurchase: 100, creditLimit: 2000, termMonths: 10 },
      },
    ]);

    const options = await getFinancingOptions('user-1', 600);

    expect(options.map((option) => option.cardId)).toEqual(['card-high-limit', 'card-high-apr']);
    expect(options[0]).toMatchObject({
      retailerName: 'BestBuy',
      apr: 0,
      minPurchase: 100,
      creditLimit: 2000,
      cashPrice: 600,
      totalRepayment: 600,
      financingCost: 0,
      rewardsValue: 12,
      rewardsAdjustedTotal: 588,
      estimatedMonthlyPayment: 60,
    });
    expect(options[1]).toMatchObject({
      retailerName: 'Amazon',
      apr: 12.99,
      estimatedMonthlyPayment: 53.59,
      totalRepayment: 643.08,
      financingCost: 43.08,
      rewardsValue: 30,
      rewardsAdjustedTotal: 613.08,
    });
  });

  it('adds installment and monthly cap warnings from saved budget controls', async () => {
    mockFindUnique.mockResolvedValue({
      shippingPref: {
        budgetControls: {
          monthlyFinancingCap: 500,
          preferredInstallmentAmount: 75,
        },
      },
    });
    mockFindMany.mockResolvedValue([
      {
        id: 'bnpl-card',
        retailerName: 'Affirm',
        cardLast4: '9999',
        rewardsRate: 0,
        financingTerms: {
          providerType: 'bnpl',
          apr: 0,
          minPurchase: 50,
          creditLimit: 1000,
          termMonths: 4,
          monthlyFee: 2,
          downPaymentPercent: 25,
        },
      },
    ]);

    const options = await getFinancingOptions('user-1', 600);

    expect(options[0]).toMatchObject({
      providerType: 'bnpl',
      downPayment: 150,
      estimatedMonthlyPayment: 112.5,
      totalRepayment: 608,
      financingCost: 8,
      budgetWarnings: [
        'Total exceeds monthly financing cap of 500.00.',
        'Monthly payment exceeds preferred installment amount of 75.00.',
      ],
    });
  });
});
