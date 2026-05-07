import { prisma } from '../index';
import { selectMatch } from './matchingService';

export function summarizeMatchReviewQueue(matches: Array<{ matchType: string; confidenceScore: number }>) {
  return {
    total: matches.length,
    lowConfidence: matches.filter((match) => match.confidenceScore < 0.8).length,
    substitutes: matches.filter((match) => match.matchType === 'substitute').length,
    exact: matches.filter((match) => match.matchType === 'exact').length,
    rejected: matches.filter((match) => match.matchType === 'rejected').length,
  };
}

export async function getMatchReviewQueue(limit = 50) {
  const matchResults = await prisma.matchResult.findMany({
    where: {
      OR: [
        { confidenceScore: { lt: 0.8 } },
        { matchType: { in: ['substitute', 'similar', 'close'] } },
      ],
    },
    include: {
      cartItem: {
        include: {
          product: true,
          cart: { include: { user: { select: { email: true } } } },
        },
      },
      retailerProduct: {
        include: { product: true },
      },
    },
    orderBy: [{ isSelected: 'desc' }, { confidenceScore: 'asc' }],
    take: Math.min(Math.max(limit, 1), 100),
  });

  const noMatchEvents = await prisma.auditEvent.findMany({
    where: { action: 'match.not_found' },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Math.floor(limit / 2), 1), 50),
  });

  return {
    summary: summarizeMatchReviewQueue(matchResults),
    matches: matchResults,
    noMatchEvents,
  };
}

export async function adminSelectMatch(cartItemId: string, retailerProductId: string, matchType = 'exact', confidence = 0.99) {
  const cartItem = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
  if (!cartItem) throw new Error('Cart item not found');

  const retailerProduct = await prisma.retailerProduct.findUnique({ where: { id: retailerProductId } });
  if (!retailerProduct) throw new Error('Retailer product not found');

  return selectMatch(cartItemId, retailerProductId, matchType, confidence);
}

export async function adminRejectMatch(matchId: string, blacklistListing = false) {
  const match = await prisma.matchResult.findUnique({
    where: { id: matchId },
    include: { retailerProduct: true },
  });

  if (!match) throw new Error('Match result not found');

  const rejected = await prisma.matchResult.update({
    where: { id: matchId },
    data: {
      matchType: 'rejected',
      confidenceScore: 0,
      isSelected: false,
    },
  });

  if (blacklistListing) {
    await prisma.retailerProduct.update({
      where: { id: match.retailerProductId },
      data: {
        inStock: false,
        counterfeitRisk: 'high',
        lastUpdated: new Date(),
      },
    });
  }

  return { match: rejected, blacklistedRetailerProductId: blacklistListing ? match.retailerProductId : null };
}
