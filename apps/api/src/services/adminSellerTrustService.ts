import { prisma } from '../index';
import { describeSellerTrust } from './sellerTrustService';

type SellerTrustListing = {
  id: string;
  retailerName: string;
  sellerName?: string | null;
  isAuthorizedSeller?: boolean | null;
  returnWindowDays?: number | null;
  warrantySupport?: boolean | null;
  customerRating?: number | null;
  counterfeitRisk?: string | null;
};

const REVIEW_SCORE_THRESHOLD = 70;

export function summarizeSellerTrustQueue(listings: SellerTrustListing[]) {
  return listings.reduce(
    (summary, listing) => {
      const trust = describeSellerTrust(listing);
      summary.total += 1;
      if (trust.score < REVIEW_SCORE_THRESHOLD) summary.needsReview += 1;
      if (listing.counterfeitRisk === 'high') summary.highRisk += 1;
      if (!listing.isAuthorizedSeller) summary.unverifiedSeller += 1;
      return summary;
    },
    { total: 0, needsReview: 0, highRisk: 0, unverifiedSeller: 0 }
  );
}

export async function getSellerTrustReviewQueue(limit = 50) {
  const listings = await prisma.retailerProduct.findMany({
    where: {
      OR: [
        { isAuthorizedSeller: false },
        { counterfeitRisk: { in: ['medium', 'high', 'unknown'] } },
        { warrantySupport: false },
        { returnWindowDays: { lt: 30 } },
      ],
    },
    include: { product: true },
    orderBy: [{ counterfeitRisk: 'desc' }, { lastUpdated: 'desc' }],
    take: Math.max(1, Math.min(limit, 100)),
  });

  const listingsWithTrust = listings.map((listing) => ({
    ...listing,
    trust: describeSellerTrust(listing),
  }));

  return {
    summary: summarizeSellerTrustQueue(listingsWithTrust),
    listings: listingsWithTrust,
  };
}

export async function updateSellerTrustListing(
  retailerProductId: string,
  data: {
    sellerName?: string;
    isAuthorizedSeller?: boolean;
    returnWindowDays?: number | null;
    warrantySupport?: boolean;
    customerRating?: number | null;
    counterfeitRisk?: string;
  }
) {
  const allowedRisks = new Set(['low', 'medium', 'high', 'unknown']);
  if (data.counterfeitRisk && !allowedRisks.has(data.counterfeitRisk)) {
    throw new Error('counterfeitRisk must be low, medium, high, or unknown');
  }

  const listing = await prisma.retailerProduct.update({
    where: { id: retailerProductId },
    data: {
      ...(data.sellerName !== undefined ? { sellerName: data.sellerName } : {}),
      ...(data.isAuthorizedSeller !== undefined ? { isAuthorizedSeller: data.isAuthorizedSeller } : {}),
      ...(data.returnWindowDays !== undefined ? { returnWindowDays: data.returnWindowDays } : {}),
      ...(data.warrantySupport !== undefined ? { warrantySupport: data.warrantySupport } : {}),
      ...(data.customerRating !== undefined ? { customerRating: data.customerRating } : {}),
      ...(data.counterfeitRisk !== undefined ? { counterfeitRisk: data.counterfeitRisk } : {}),
    },
    include: { product: true },
  });

  return {
    ...listing,
    trust: describeSellerTrust(listing),
  };
}
