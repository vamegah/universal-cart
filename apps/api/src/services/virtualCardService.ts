import axios from 'axios';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { getRetailerDefinitionByName } from '../integrations/registry';
import { logger } from '../utils/logger';
import { assertMockPaymentsAllowed, getConfiguredBaasProvider } from './paymentModeService';
import { recordSettlementEntriesForCheckout, recordSettlementFailure } from './settlementLedgerService';

export interface IssuedVirtualCard {
  last4: string;
  expiry: string;
}

interface InternalIssuedVirtualCard extends IssuedVirtualCard {
  cardToken: string;
  provider: string;
  providerCardId?: string;
}

interface IssueOptions {
  userId?: string;
  metadata?: Record<string, unknown>;
}

function assertPositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be greater than 0');
  }
}

function normalizeMerchantName(merchantName: string) {
  const normalized = merchantName.trim();
  if (!normalized) throw new Error('merchantName is required');
  return normalized;
}

function formatExpiry(month: unknown, year: unknown) {
  const expMonth = String(month || '').padStart(2, '0').slice(-2);
  const expYear = String(year || '').slice(-2);
  return `${expMonth}/${expYear}`;
}

function cents(amount: number) {
  return Math.round(amount * 100);
}

async function issueMockVirtualCard(amount: number, merchantName: string): Promise<InternalIssuedVirtualCard> {
  assertMockPaymentsAllowed('Mock virtual cards');
  logger.warn('Issuing mock virtual card', { merchantName, amount });
  return {
    provider: 'mock',
    providerCardId: `mock-card-${merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${cents(amount)}`,
    cardToken: `mock-token-${merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${cents(amount)}`,
    last4: '1111',
    expiry: '12/29',
  };
}

async function issueStripeVirtualCard(amount: number, merchantName: string): Promise<InternalIssuedVirtualCard> {
  const apiKey = process.env.STRIPE_ISSUING_API_KEY || process.env.STRIPE_SECRET_KEY;
  const cardholder = process.env.STRIPE_ISSUING_CARDHOLDER_ID;
  if (!apiKey || !cardholder) {
    throw new Error('Stripe Issuing is not configured');
  }

  const params = new URLSearchParams();
  params.set('currency', 'usd');
  params.set('type', 'virtual');
  params.set('cardholder', cardholder);
  params.set('status', 'active');
  params.set('spending_controls[spending_limits][0][amount]', String(cents(amount)));
  params.set('spending_controls[spending_limits][0][interval]', 'per_authorization');
  params.set('metadata[merchantName]', merchantName);
  params.set('metadata[merchantLocked]', 'true');

  const response = await axios.post('https://api.stripe.com/v1/issuing/cards', params, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const card = response.data || {};
  return {
    provider: 'stripe',
    providerCardId: card.id,
    cardToken: card.id,
    last4: String(card.last4 || '').slice(-4),
    expiry: formatExpiry(card.exp_month, card.exp_year),
  };
}

async function issueProviderVirtualCard(amount: number, merchantName: string) {
  if (process.env.ENABLE_MOCK_PAYMENTS === 'true') {
    return issueMockVirtualCard(amount, merchantName);
  }

  const provider = getConfiguredBaasProvider();
  if (provider !== 'stripe') {
    throw new Error(`Unsupported BaaS provider: ${provider}`);
  }

  return issueStripeVirtualCard(amount, merchantName);
}

async function recordVirtualCardTransaction(
  userId: string,
  merchantName: string,
  amount: number,
  card: InternalIssuedVirtualCard,
  metadata: Record<string, unknown> = {}
) {
  return prisma.virtualCardTransaction.create({
    data: {
      userId,
      retailerName: merchantName,
      amount,
      virtualCardLast4: card.last4,
      cardToken: card.cardToken,
      provider: card.provider,
      providerCardId: card.providerCardId,
      expiry: card.expiry,
      metadata: metadata as Prisma.InputJsonValue,
      status: 'issued',
    },
  });
}

async function issueVirtualCardInternal(amount: number, merchantName: string, options: IssueOptions = {}) {
  assertPositiveAmount(amount);
  const normalizedMerchantName = normalizeMerchantName(merchantName);
  const card = await issueProviderVirtualCard(amount, normalizedMerchantName);

  const transaction = options.userId
    ? await recordVirtualCardTransaction(options.userId, normalizedMerchantName, amount, card, options.metadata)
    : null;

  return { card, transaction };
}

export async function issueVirtualCard(
  amount: number,
  merchantName: string,
  userId?: string
): Promise<IssuedVirtualCard> {
  const { card } = await issueVirtualCardInternal(amount, merchantName, { userId });
  return { last4: card.last4, expiry: card.expiry };
}

function getSelectedRetailerProduct(item: any) {
  const selectedMatch = (item.matchResults || []).find((match: any) => match.isSelected && match.retailerProduct);
  return selectedMatch?.retailerProduct || null;
}

function groupCartItemsByRetailer(cart: any) {
  const groups = new Map<string, Array<{ item: any; retailerProduct: any }>>();
  for (const item of cart.items || []) {
    const retailerProduct = getSelectedRetailerProduct(item);
    if (!retailerProduct?.inStock) continue;
    const retailerName = retailerProduct.retailerName;
    const current = groups.get(retailerName) || [];
    current.push({ item, retailerProduct });
    groups.set(retailerName, current);
  }
  return groups;
}

function retailerGroupTotal(group: Array<{ item: any; retailerProduct: any }>) {
  return group.reduce((sum, { item, retailerProduct }) => {
    return sum + Number(retailerProduct.price || 0) * Number(item.quantity || 1);
  }, 0);
}

function retailerProductIdentifier(retailerProduct: any) {
  return retailerProduct.retailerSku || retailerProduct.id || retailerProduct.url;
}

export async function checkoutWithVirtualCard(cartId: string, userId: string, userCardId?: string) {
  const cart = await prisma.universalCart.findFirst({
    where: { id: cartId, userId },
    include: {
      items: {
        include: {
          matchResults: {
            include: { retailerProduct: true },
          },
        },
      },
    },
  });

  if (!cart) throw new Error('Cart not found');

  const retailerGroups = groupCartItemsByRetailer(cart);
  if (retailerGroups.size === 0) throw new Error('No selected in-stock retailer products available for virtual checkout');

  const checkouts = [];
  for (const [retailerName, group] of retailerGroups.entries()) {
    const amount = retailerGroupTotal(group);
    const { card, transaction } = await issueVirtualCardInternal(amount, retailerName, {
      userId,
      metadata: { cartId, userCardId: userCardId || null, itemCount: group.length },
    });

    try {
      const definition = getRetailerDefinitionByName(retailerName);
      if (!definition) throw new Error(`Retailer ${retailerName} is not supported for virtual checkout`);

      const adapter = new definition.adapter();
      const cartUrls = [];
      for (const { item, retailerProduct } of group) {
        const identifier = retailerProductIdentifier(retailerProduct);
        if (!identifier) throw new Error(`Missing retailer product identifier for ${retailerName}`);
        const cartUrl = await adapter.addToCart(identifier, Number(item.quantity || 1), {
          virtualCardToken: card.cardToken,
        });
        cartUrls.push(cartUrl);
      }

      if (transaction) {
        await prisma.virtualCardTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'charged',
            metadata: {
              ...(transaction.metadata as Record<string, unknown> | null),
              cartUrls,
            },
          },
        });
        await recordSettlementEntriesForCheckout({
          userId,
          cartId,
          virtualCardTransactionId: transaction.id,
          retailerName,
          amount,
          metadata: {
            cartUrls,
            userCardId: userCardId || null,
            itemCount: group.length,
          },
        });
      }

      checkouts.push({
        retailerName,
        amount,
        transactionId: transaction?.id || null,
        virtualCard: { last4: card.last4, expiry: card.expiry },
        cartUrls,
        status: 'charged',
      });
    } catch (error) {
      if (transaction) {
        const errorMessage = error instanceof Error ? error.message : 'Virtual checkout failed';
        await prisma.virtualCardTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'failed',
            metadata: {
              ...(transaction.metadata as Record<string, unknown> | null),
              error: errorMessage,
            },
          },
        });
        await recordSettlementFailure({
          userId,
          cartId,
          virtualCardTransactionId: transaction.id,
          retailerName,
          amount,
          error: errorMessage,
          metadata: {
            userCardId: userCardId || null,
            itemCount: group.length,
          },
        });
      }
      throw error;
    }
  }

  logger.info('Virtual checkout completed', { cartId, userId, retailerCount: checkouts.length });
  return { success: true, checkouts };
}
