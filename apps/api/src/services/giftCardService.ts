import { getGiftCardBrokerAdapter } from '../integrations/giftCardBroker/adapter';
import { prisma } from '../index';
import { recordAuditEvent } from './auditService';
import { encryptCardToken } from './paymentVaultService';

export class GiftCardServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'GiftCardServiceError';
    this.statusCode = statusCode;
  }
}

function parseAmount(amount: unknown) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new GiftCardServiceError('amount must be a positive number');
  }
  return Math.round(parsed * 100) / 100;
}

function parseRetailerName(retailerName: unknown) {
  const parsed = String(retailerName || '').trim();
  if (!parsed) {
    throw new GiftCardServiceError('retailerName is required');
  }
  return parsed;
}

function giftCardPurchaseLimits() {
  return {
    maxSinglePurchaseAmount: Number(process.env.GIFT_CARD_MAX_SINGLE_AMOUNT || 250),
    maxDailyAmount: Number(process.env.GIFT_CARD_MAX_DAILY_AMOUNT || 500),
    maxDailyCount: Number(process.env.GIFT_CARD_MAX_DAILY_COUNT || 5),
  };
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseExpiration(expiresAt?: string) {
  if (!expiresAt) return null;
  const parsed = new Date(expiresAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function publicGiftCard(giftCard: any) {
  return {
    id: giftCard.id,
    retailerName: giftCard.retailerName,
    amount: giftCard.amount,
    balance: giftCard.balance,
    currency: giftCard.currency,
    codeLast4: giftCard.codeLast4,
    brokerProvider: giftCard.brokerProvider,
    brokerReference: giftCard.brokerReference,
    status: giftCard.status,
    expiresAt: giftCard.expiresAt,
    fraudRisk: giftCard.fraudRisk,
    buyerProtection: giftCard.buyerProtection,
    createdAt: giftCard.createdAt,
  };
}

async function assertPurchaseLimits(userId: string, retailerName: string, amount: number) {
  const limits = giftCardPurchaseLimits();
  if (amount > limits.maxSinglePurchaseAmount) {
    throw new GiftCardServiceError(`amount exceeds single purchase limit of ${limits.maxSinglePurchaseAmount}`);
  }

  const since = startOfUtcDay();
  const [dailyCount, dailyAmount] = await Promise.all([
    (prisma as any).purchasedGiftCard.count({
      where: { userId, createdAt: { gte: since } },
    }),
    (prisma as any).purchasedGiftCard.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: { amount: true },
    }),
  ]);

  if (dailyCount >= limits.maxDailyCount) {
    throw new GiftCardServiceError(`daily gift card purchase count limit of ${limits.maxDailyCount} reached`);
  }

  const totalAfterPurchase = Number(dailyAmount?._sum?.amount || 0) + amount;
  if (totalAfterPurchase > limits.maxDailyAmount) {
    throw new GiftCardServiceError(`daily gift card purchase amount limit of ${limits.maxDailyAmount} exceeded`);
  }

  const retailerDailyAmount = await (prisma as any).purchasedGiftCard.aggregate({
    where: { userId, retailerName, createdAt: { gte: since } },
    _sum: { amount: true },
  });
  const retailerTotalAfterPurchase = Number(retailerDailyAmount?._sum?.amount || 0) + amount;
  if (retailerTotalAfterPurchase > limits.maxDailyAmount) {
    throw new GiftCardServiceError(`daily ${retailerName} gift card purchase amount limit exceeded`);
  }
}

export async function purchaseGiftCard(userId: string, retailerNameInput: unknown, amountInput: unknown) {
  const retailerName = parseRetailerName(retailerNameInput);
  const amount = parseAmount(amountInput);
  await assertPurchaseLimits(userId, retailerName, amount);

  let giftCard;
  try {
    const broker = getGiftCardBrokerAdapter();
    giftCard = await broker.purchaseGiftCard(retailerName, amount);
  } catch (error) {
    throw new GiftCardServiceError(error instanceof Error ? error.message : 'Gift card purchases are not configured', 503);
  }
  const codeLast4 = giftCard.code.slice(-4);
  const expiresAt = parseExpiration(giftCard.expiresAt);
  const persisted = await (prisma as any).purchasedGiftCard.create({
    data: {
      userId,
      retailerName,
      amount,
      balance: giftCard.balance,
      currency: giftCard.currency || 'USD',
      codeLast4,
      encryptedCode: encryptCardToken(giftCard.code),
      encryptedPin: giftCard.pin ? encryptCardToken(giftCard.pin) : null,
      brokerProvider: giftCard.provider,
      brokerReference: giftCard.brokerReference || null,
      status: giftCard.fraudRisk === 'high' ? 'flagged' : 'active',
      expiresAt,
      fraudRisk: giftCard.fraudRisk || 'unknown',
      buyerProtection: giftCard.buyerProtection || null,
      metadata: {
        purchaseLimitPolicy: giftCardPurchaseLimits(),
      },
    },
  });

  await recordAuditEvent({
    userId,
    action: giftCard.provider === 'mock' ? 'giftcard.purchase_mocked' : 'giftcard.purchase',
    entityType: 'gift_card_purchase',
    entityId: persisted.id,
    summary: `Purchased ${giftCard.provider === 'mock' ? 'mock ' : ''}gift card for ${retailerName}`,
    metadata: {
      giftCardId: persisted.id,
      retailerName,
      amount,
      balance: giftCard.balance,
      codeLast4,
      brokerProvider: giftCard.provider,
      brokerReference: giftCard.brokerReference,
      expiresAt: expiresAt?.toISOString() || null,
      fraudRisk: giftCard.fraudRisk || 'unknown',
      mock: giftCard.provider === 'mock',
    },
  });

  return {
    id: persisted.id,
    retailerName,
    amount,
    code: giftCard.code,
    pin: giftCard.pin,
    balance: giftCard.balance,
    currency: persisted.currency,
    codeLast4,
    brokerProvider: giftCard.provider,
    brokerReference: giftCard.brokerReference,
    status: persisted.status,
    expiresAt: persisted.expiresAt,
    fraudRisk: persisted.fraudRisk,
    buyerProtection: persisted.buyerProtection,
    mock: giftCard.provider === 'mock',
  };
}

export async function listGiftCards(userId: string) {
  const giftCards = await (prisma as any).purchasedGiftCard.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return giftCards.map(publicGiftCard);
}
