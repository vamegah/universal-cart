/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreateTransaction = jest.fn<(args: any) => Promise<any>>();
const mockUpdateTransaction = jest.fn<(args: any) => Promise<any>>();
const mockFindCart = jest.fn<(args: any) => Promise<any>>();
const mockAddToCart = jest.fn<(productId: string, quantity: number, payment?: any) => Promise<string>>();
const mockGetRetailerDefinitionByName = jest.fn();
const mockRecordSettlementEntriesForCheckout = jest.fn<(args: any) => Promise<any>>();
const mockRecordSettlementFailure = jest.fn<(args: any) => Promise<any>>();

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    virtualCardTransaction: {
      create: mockCreateTransaction,
      update: mockUpdateTransaction,
    },
    universalCart: {
      findFirst: mockFindCart,
    },
  },
}));

jest.mock('../../apps/api/src/integrations/registry', () => ({
  getRetailerDefinitionByName: mockGetRetailerDefinitionByName,
}));

jest.mock('../../apps/api/src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../apps/api/src/services/settlementLedgerService', () => ({
  recordSettlementEntriesForCheckout: mockRecordSettlementEntriesForCheckout,
  recordSettlementFailure: mockRecordSettlementFailure,
}));

import { checkoutWithVirtualCard, issueVirtualCard } from '../../apps/api/src/services/virtualCardService';

const originalMockPayments = process.env.ENABLE_MOCK_PAYMENTS;
const originalNodeEnv = process.env.NODE_ENV;

describe('virtualCardService', () => {
  beforeEach(() => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';
    mockCreateTransaction.mockReset();
    mockUpdateTransaction.mockReset();
    mockFindCart.mockReset();
    mockAddToCart.mockReset();
    mockGetRetailerDefinitionByName.mockReset();
    mockRecordSettlementEntriesForCheckout.mockReset();
    mockRecordSettlementFailure.mockReset();
    mockCreateTransaction.mockResolvedValue({
      id: 'txn-1',
      metadata: { cartId: 'cart-1' },
    });
    mockUpdateTransaction.mockResolvedValue({});
    mockAddToCart.mockResolvedValue('https://target.example/cart');
    mockRecordSettlementEntriesForCheckout.mockResolvedValue([]);
    mockRecordSettlementFailure.mockResolvedValue({});
    mockGetRetailerDefinitionByName.mockReturnValue({
      name: 'Target',
      adapter: class {
        fetchProduct = jest.fn();
        addToCart = mockAddToCart;
      },
    });
  });

  afterEach(() => {
    if (originalMockPayments === undefined) {
      delete process.env.ENABLE_MOCK_PAYMENTS;
    } else {
      process.env.ENABLE_MOCK_PAYMENTS = originalMockPayments;
    }
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  });

  it('issues a provider token-backed card without returning raw card data', async () => {
    const card = await issueVirtualCard(42.5, 'Target', 'user-1');

    expect(card).toEqual({ last4: '1111', expiry: '12/29' });
    expect(card).not.toHaveProperty('cardToken');
    expect(card).not.toHaveProperty('cardNumber');
    expect(mockCreateTransaction).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        retailerName: 'Target',
        amount: 42.5,
        virtualCardLast4: '1111',
        cardToken: expect.stringContaining('mock-token-target'),
        provider: 'mock',
        status: 'issued',
      }),
    });
  });

  it('refuses mock virtual cards in production even if the mock flag is set', async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';
    Object.assign(process.env, { NODE_ENV: 'production' });

    await expect(issueVirtualCard(42.5, 'Target', 'user-1')).rejects.toThrow(
      'Mock virtual cards cannot be enabled in production'
    );
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });

  it('groups selected cart matches by retailer and passes the virtual card token to addToCart', async () => {
    mockFindCart.mockResolvedValue({
      id: 'cart-1',
      items: [
        {
          quantity: 2,
          matchResults: [
            {
              isSelected: true,
              retailerProduct: {
                id: 'rp-1',
                retailerName: 'Target',
                retailerSku: 'sku-1',
                price: 15,
                inStock: true,
              },
            },
          ],
        },
      ],
    });

    const result = await checkoutWithVirtualCard('cart-1', 'user-1', 'card-1');

    expect(result).toMatchObject({
      success: true,
      checkouts: [
        {
          retailerName: 'Target',
          amount: 30,
          transactionId: 'txn-1',
          status: 'charged',
        },
      ],
    });
    expect(mockAddToCart).toHaveBeenCalledWith('sku-1', 2, {
      virtualCardToken: expect.stringContaining('mock-token-target'),
    });
    expect(mockUpdateTransaction).toHaveBeenCalledWith({
      where: { id: 'txn-1' },
      data: expect.objectContaining({ status: 'charged' }),
    });
    expect(mockRecordSettlementEntriesForCheckout).toHaveBeenCalledWith({
      userId: 'user-1',
      cartId: 'cart-1',
      virtualCardTransactionId: 'txn-1',
      retailerName: 'Target',
      amount: 30,
      metadata: {
        cartUrls: ['https://target.example/cart'],
        userCardId: 'card-1',
        itemCount: 1,
      },
    });
    expect(mockRecordSettlementFailure).not.toHaveBeenCalled();
  });

  it('records a failed authorization ledger entry when retailer checkout fails', async () => {
    mockFindCart.mockResolvedValue({
      id: 'cart-1',
      items: [
        {
          quantity: 1,
          matchResults: [
            {
              isSelected: true,
              retailerProduct: {
                id: 'rp-1',
                retailerName: 'Target',
                retailerSku: 'sku-1',
                price: 12,
                inStock: true,
              },
            },
          ],
        },
      ],
    });
    mockAddToCart.mockRejectedValue(new Error('Retailer checkout unavailable'));

    await expect(checkoutWithVirtualCard('cart-1', 'user-1')).rejects.toThrow('Retailer checkout unavailable');

    expect(mockUpdateTransaction).toHaveBeenCalledWith({
      where: { id: 'txn-1' },
      data: expect.objectContaining({
        status: 'failed',
        metadata: expect.objectContaining({ error: 'Retailer checkout unavailable' }),
      }),
    });
    expect(mockRecordSettlementFailure).toHaveBeenCalledWith({
      userId: 'user-1',
      cartId: 'cart-1',
      virtualCardTransactionId: 'txn-1',
      retailerName: 'Target',
      amount: 12,
      error: 'Retailer checkout unavailable',
      metadata: {
        userCardId: null,
        itemCount: 1,
      },
    });
    expect(mockRecordSettlementEntriesForCheckout).not.toHaveBeenCalled();
  });
});
