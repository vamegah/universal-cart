/**
 * @jest-environment node
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreateMany = jest.fn<(args: any) => Promise<any>>();
const mockCreate = jest.fn<(args: any) => Promise<any>>();

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    settlementLedgerEntry: {
      createMany: mockCreateMany,
      create: mockCreate,
    },
  },
}));

import {
  assertSettlementEntriesBalance,
  buildSettlementRefundEntries,
  buildSettlementEntries,
  recordSettlementEntriesForCheckout,
  recordSettlementFailure,
  recordSettlementRefund,
} from '../../apps/api/src/services/settlementLedgerService';

describe('settlementLedgerService', () => {
  beforeEach(() => {
    mockCreateMany.mockReset();
    mockCreate.mockReset();
    mockCreateMany.mockResolvedValue({ count: 3 });
    mockCreate.mockResolvedValue({});
  });

  it('builds balanced posted entries for a charged retailer checkout', async () => {
    const entries = await recordSettlementEntriesForCheckout({
      userId: 'user-1',
      cartId: 'cart-1',
      virtualCardTransactionId: 'txn-1',
      retailerName: 'Target',
      amount: 50,
      platformFee: 2.5,
      metadata: { cartUrls: ['https://target.example/cart'] },
    });

    expect(entries).toEqual([
      expect.objectContaining({ entryType: 'platform_charge', amount: 50, status: 'posted' }),
      expect.objectContaining({ entryType: 'retailer_payout', amount: -47.5, status: 'posted' }),
      expect.objectContaining({ entryType: 'platform_fee', amount: -2.5, status: 'posted' }),
    ]);
    expect(entries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(0);
    expect(mockCreateMany).toHaveBeenCalledWith({ data: entries });
  });

  it('rejects settlement entries that do not balance', () => {
    expect(() => assertSettlementEntriesBalance([{ amount: 10 }, { amount: -9.99 }])).toThrow(
      'Settlement ledger entries must balance to zero'
    );
  });

  it('records checkout failures as zero-dollar failed authorizations with attempted amount metadata', async () => {
    const entry = await recordSettlementFailure({
      userId: 'user-1',
      cartId: 'cart-1',
      virtualCardTransactionId: 'txn-1',
      retailerName: 'Target',
      amount: 12.345,
      error: 'Retailer checkout unavailable',
    });

    expect(entry).toMatchObject({
      entryType: 'failed_authorization',
      amount: 0,
      status: 'failed',
      metadata: {
        attemptedAmount: 12.35,
        error: 'Retailer checkout unavailable',
      },
    });
    expect(mockCreate).toHaveBeenCalledWith({ data: entry });
  });

  it('builds balanced refund reversal entries', async () => {
    const entries = await recordSettlementRefund({
      userId: 'user-1',
      cartId: 'cart-1',
      virtualCardTransactionId: 'txn-1',
      retailerName: 'Target',
      amount: 25,
      platformFee: 1,
      reason: 'customer_return',
    });

    expect(entries).toEqual([
      expect.objectContaining({ entryType: 'refund', amount: -25, status: 'posted' }),
      expect.objectContaining({ entryType: 'retailer_payout_reversal', amount: 24, status: 'posted' }),
      expect.objectContaining({ entryType: 'platform_fee_reversal', amount: 1, status: 'posted' }),
    ]);
    expect(entries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(0);
    expect(mockCreateMany).toHaveBeenCalledWith({ data: entries });
  });

  it('rejects impossible platform fees', () => {
    expect(() =>
      buildSettlementEntries({
        userId: 'user-1',
        cartId: 'cart-1',
        virtualCardTransactionId: 'txn-1',
        retailerName: 'Target',
        amount: 10,
        platformFee: 11,
      })
    ).toThrow('platformFee cannot exceed amount');
  });

  it('rejects refund entries without a positive amount', () => {
    expect(() =>
      buildSettlementRefundEntries({
        userId: 'user-1',
        cartId: 'cart-1',
        virtualCardTransactionId: 'txn-1',
        retailerName: 'Target',
        amount: 0,
        reason: 'customer_return',
      })
    ).toThrow('amount must be greater than 0');
  });
});
