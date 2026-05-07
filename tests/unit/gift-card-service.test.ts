/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';
import {
  getGiftCardBrokerAdapter,
  HttpGiftCardBrokerAdapter,
  MockGiftCardBrokerAdapter,
} from '../../apps/api/src/integrations/giftCardBroker/adapter';
import { GiftCardServiceError, listGiftCards, purchaseGiftCard } from '../../apps/api/src/services/giftCardService';
import { recordAuditEvent } from '../../apps/api/src/services/auditService';
import { prisma } from '../../apps/api/src/index';

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    purchasedGiftCard: {
      count: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../apps/api/src/services/auditService', () => ({
  recordAuditEvent: jest.fn(),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const mockGiftCardCount = (prisma as any).purchasedGiftCard.count as jest.Mock<any>;
const mockGiftCardAggregate = (prisma as any).purchasedGiftCard.aggregate as jest.Mock<any>;
const mockGiftCardCreate = (prisma as any).purchasedGiftCard.create as jest.Mock<any>;
const mockGiftCardFindMany = (prisma as any).purchasedGiftCard.findMany as jest.Mock<any>;

describe('gift card broker mock adapter', () => {
  const originalFlag = process.env.ENABLE_MOCK_PAYMENTS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ENABLE_MOCK_PAYMENTS;
    } else {
      process.env.ENABLE_MOCK_PAYMENTS = originalFlag;
    }
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    delete process.env.GIFT_CARD_MAX_DAILY_COUNT;
    delete process.env.GIFT_CARD_MAX_DAILY_AMOUNT;
    delete process.env.GIFT_CARD_MAX_SINGLE_AMOUNT;
    delete process.env.GIFT_CARD_BROKER_PROVIDER;
    delete process.env.GIFT_CARD_BROKER_URL;
    delete process.env.GIFT_CARD_BROKER_API_KEY;
    (recordAuditEvent as jest.Mock).mockReset();
    (axios.post as jest.Mock<any>).mockReset();
    mockGiftCardCount.mockReset();
    mockGiftCardAggregate.mockReset();
    mockGiftCardCreate.mockReset();
    mockGiftCardFindMany.mockReset();
    mockGiftCardCount.mockResolvedValue(0);
    mockGiftCardAggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockGiftCardCreate.mockImplementation(async (args: any) => ({
      id: 'gift-card-1',
      createdAt: new Date('2026-05-06T12:00:00Z'),
      updatedAt: new Date('2026-05-06T12:00:00Z'),
      ...args.data,
    }));
  });

  beforeEach(() => {
    mockGiftCardCount.mockResolvedValue(0);
    mockGiftCardAggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockGiftCardCreate.mockImplementation(async (args: any) => ({
      id: 'gift-card-1',
      createdAt: new Date('2026-05-06T12:00:00Z'),
      updatedAt: new Date('2026-05-06T12:00:00Z'),
      ...args.data,
    }));
  });

  it('is disabled unless mock payments are explicitly enabled', async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'false';

    await expect(new MockGiftCardBrokerAdapter().purchaseGiftCard('Target', 25)).rejects.toThrow(
      'Mock gift card broker is not configured'
    );
  });

  it('returns a deterministic mock code when mock payments are enabled', async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';

    const adapter = new MockGiftCardBrokerAdapter();
    const first = await adapter.purchaseGiftCard('Target', 25);
    const second = await adapter.purchaseGiftCard('Target', 25);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      code: 'MOCK-GC-TARGET-00002500',
      balance: 25,
    });
    expect(first.pin).toMatch(/^\d{4}$/);
  });

  it('uses the configured HTTP broker adapter without exposing API keys', async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'false';
    process.env.GIFT_CARD_BROKER_PROVIDER = 'http';
    process.env.GIFT_CARD_BROKER_URL = 'https://broker.example/purchases';
    process.env.GIFT_CARD_BROKER_API_KEY = 'broker-secret';
    (axios.post as jest.Mock<any>).mockResolvedValue({
      data: {
        id: 'broker-ref-1',
        redemptionCode: 'REAL-GC-TARGET-1234',
        pin: '9876',
        balance: 25,
        currency: 'USD',
        provider: 'example-broker',
        expiresAt: '2027-01-01T00:00:00.000Z',
        fraudRisk: 'medium',
        buyerProtection: { replacementEligible: true, refundWindowDays: 7 },
      },
    });

    const adapter = getGiftCardBrokerAdapter();
    expect(adapter).toBeInstanceOf(HttpGiftCardBrokerAdapter);

    const purchase = await adapter.purchaseGiftCard('Target', 25);

    expect(purchase).toMatchObject({
      code: 'REAL-GC-TARGET-1234',
      provider: 'example-broker',
      brokerReference: 'broker-ref-1',
      fraudRisk: 'medium',
    });
    expect(axios.post).toHaveBeenCalledWith(
      'https://broker.example/purchases',
      expect.objectContaining({ retailerName: 'Target', amount: 25, buyerProtectionRequired: true }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer broker-secret' }),
      })
    );
  });

  it('refuses mock gift cards in production even if the mock flag is set', async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';
    Object.assign(process.env, { NODE_ENV: 'production' });

    await expect(new MockGiftCardBrokerAdapter().purchaseGiftCard('Target', 25)).rejects.toThrow(
      'Mock gift card broker cannot be enabled in production'
    );
    await expect(purchaseGiftCard('user-1', 'Target', 25)).rejects.toMatchObject({
      name: 'GiftCardServiceError',
      statusCode: 503,
    });
  });

  it('records an audit event without putting the full code in metadata', async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';

    const result = await purchaseGiftCard('user-1', 'Macy\'s', 42.5);

    expect(result).toMatchObject({
      id: 'gift-card-1',
      retailerName: "Macy's",
      amount: 42.5,
      code: 'MOCK-GC-MACY-S-00004250',
      balance: 42.5,
      codeLast4: '4250',
      brokerProvider: 'mock',
      status: 'active',
      fraudRisk: 'low',
      mock: true,
    });
    expect(mockGiftCardCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        retailerName: "Macy's",
        amount: 42.5,
        balance: 42.5,
        codeLast4: '4250',
        encryptedCode: expect.stringContaining('enc:v1:'),
        encryptedPin: expect.stringContaining('enc:v1:'),
        brokerProvider: 'mock',
        brokerReference: 'mock-gc-macy-s-4250',
        fraudRisk: 'low',
      }),
    });
    expect(recordAuditEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      action: 'giftcard.purchase_mocked',
      entityType: 'gift_card_purchase',
      entityId: 'gift-card-1',
      summary: "Purchased mock gift card for Macy's",
      metadata: {
        giftCardId: 'gift-card-1',
        retailerName: "Macy's",
        amount: 42.5,
        balance: 42.5,
        codeLast4: '4250',
        brokerProvider: 'mock',
        brokerReference: 'mock-gc-macy-s-4250',
        expiresAt: '2099-12-31T00:00:00.000Z',
        fraudRisk: 'low',
        mock: true,
      },
    });
  });

  it('validates purchase amount', async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';

    await expect(purchaseGiftCard('user-1', 'Target', 0)).rejects.toMatchObject({
      name: 'GiftCardServiceError',
      message: 'amount must be a positive number',
      statusCode: 400,
    } satisfies Partial<GiftCardServiceError>);
  });

  it('enforces daily gift card purchase count limits before broker purchase', async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';
    process.env.GIFT_CARD_MAX_DAILY_COUNT = '1';
    mockGiftCardCount.mockResolvedValue(1);

    await expect(purchaseGiftCard('user-1', 'Target', 25)).rejects.toMatchObject({
      name: 'GiftCardServiceError',
      message: 'daily gift card purchase count limit of 1 reached',
    });
    expect(mockGiftCardCreate).not.toHaveBeenCalled();
    delete process.env.GIFT_CARD_MAX_DAILY_COUNT;
  });

  it('lists purchased gift cards without redemption codes or encrypted values', async () => {
    mockGiftCardFindMany.mockResolvedValue([
      {
        id: 'gift-card-1',
        retailerName: 'Target',
        amount: 25,
        balance: 10,
        currency: 'USD',
        codeLast4: '2500',
        encryptedCode: 'enc:v1:hidden',
        encryptedPin: 'enc:v1:hidden-pin',
        brokerProvider: 'mock',
        brokerReference: 'mock-gc-target-2500',
        status: 'active',
        expiresAt: new Date('2099-12-31T00:00:00Z'),
        fraudRisk: 'low',
        buyerProtection: { replacementEligible: false },
        createdAt: new Date('2026-05-06T12:00:00Z'),
      },
    ]);

    const giftCards = await listGiftCards('user-1');

    expect(giftCards).toEqual([
      expect.objectContaining({
        id: 'gift-card-1',
        codeLast4: '2500',
        balance: 10,
        fraudRisk: 'low',
      }),
    ]);
    expect(giftCards[0]).not.toHaveProperty('code');
    expect(giftCards[0]).not.toHaveProperty('pin');
    expect(giftCards[0]).not.toHaveProperty('encryptedCode');
    expect(giftCards[0]).not.toHaveProperty('encryptedPin');
  });
});
