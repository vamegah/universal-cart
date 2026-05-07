import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { prisma } from '../../apps/api/src/index';
import { evaluateAutoBuyRules } from '../../apps/api/src/services/autoBuyScheduler';

describe('auto-buy worker integration pipeline', () => {
  const originalMockPayments = process.env.ENABLE_MOCK_PAYMENTS;
  const email = `autobuy-${Date.now()}@example.com`;
  let userId: string;
  let productId: string;
  let retailerProductId: string;
  let cartId: string;
  let cartItemId: string;
  let ruleId: string;

  beforeAll(async () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'integration-only',
      },
    });
    userId = user.id;

    const product = await prisma.product.create({
      data: {
        name: 'AutoBuy Integration Coffee',
        brand: 'Acme',
        category: 'grocery',
      },
    });
    productId = product.id;

    const retailerProduct = await prisma.retailerProduct.create({
      data: {
        productId,
        retailerName: 'Amazon',
        retailerSku: 'AUTOCOFFEE1',
        price: 12.5,
        url: 'https://www.amazon.com/dp/AUTOCOFFEE1',
        inStock: true,
      },
    });
    retailerProductId = retailerProduct.id;

    const cart = await prisma.universalCart.create({
      data: {
        userId,
        status: 'active',
      },
    });
    cartId = cart.id;

    const cartItem = await prisma.cartItem.create({
      data: {
        cartId,
        productId,
        sourceRetailer: 'Amazon',
        quantity: 2,
      },
    });
    cartItemId = cartItem.id;

    await prisma.matchResult.create({
      data: {
        cartItemId,
        retailerProductId,
        matchType: 'exact',
        confidenceScore: 0.99,
        isSelected: true,
      },
    });

    const rule = await prisma.autoBuyRule.create({
      data: {
        userId,
        cartId,
        trigger: {
          type: 'total_price_below',
          value: 30,
          userConsentAccepted: true,
          maxSpendAmount: 30,
          confirmationPolicy: 'auto_execute',
          cancellationWindowMinutes: 0,
          approvedAt: '2026-05-05T11:00:00.000Z',
        },
        destinationPref: 'split_optimized',
        status: 'active',
      },
    });
    ruleId = rule.id;
  });

  afterAll(async () => {
    if (originalMockPayments === undefined) {
      delete process.env.ENABLE_MOCK_PAYMENTS;
    } else {
      process.env.ENABLE_MOCK_PAYMENTS = originalMockPayments;
    }

    if (userId) await prisma.settlementLedgerEntry.deleteMany({ where: { userId } });
    if (userId) await prisma.virtualCardTransaction.deleteMany({ where: { userId } });
    if (userId) await prisma.auditEvent.deleteMany({ where: { userId } });
    if (ruleId) await prisma.autoBuyRule.deleteMany({ where: { id: ruleId } });
    if (cartItemId) await prisma.matchResult.deleteMany({ where: { cartItemId } });
    if (cartItemId) await prisma.cartItem.deleteMany({ where: { id: cartItemId } });
    if (cartId) await prisma.universalCart.deleteMany({ where: { id: cartId } });
    if (retailerProductId) await prisma.retailerProduct.deleteMany({ where: { id: retailerProductId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('executes an eligible rule and records a virtual card transaction', async () => {
    await evaluateAutoBuyRules({ now: new Date('2026-05-05T12:00:00.000Z') });

    const rule = await prisma.autoBuyRule.findUniqueOrThrow({ where: { id: ruleId } });
    expect(rule.status).toBe('executed');
    expect(rule.executedAt).toBeInstanceOf(Date);

    const transaction = await prisma.virtualCardTransaction.findFirst({
      where: { userId, retailerName: 'Amazon' },
      orderBy: { createdAt: 'desc' },
    });
    expect(transaction).toMatchObject({
      amount: 25,
      virtualCardLast4: '1111',
      provider: 'mock',
      status: 'charged',
    });
  });
});
