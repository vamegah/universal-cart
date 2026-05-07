type TrustListing = {
  retailerName?: string | null;
  sellerName?: string | null;
  isAuthorizedSeller?: boolean | null;
  returnWindowDays?: number | null;
  warrantySupport?: boolean | null;
  customerRating?: number | null;
  counterfeitRisk?: string | null;
};

const FIRST_PARTY_RETAILERS = new Set(['Amazon', 'Walmart', 'Target', 'Best Buy', "Macy's"]);

export function inferSellerTrustDefaults(retailerName: string) {
  const firstParty = FIRST_PARTY_RETAILERS.has(retailerName);
  return {
    sellerName: retailerName,
    isAuthorizedSeller: firstParty,
    returnWindowDays: firstParty ? 30 : null,
    warrantySupport: firstParty,
    customerRating: null,
    counterfeitRisk: firstParty ? 'low' : 'unknown',
  };
}

export function calculateSellerTrustScore(listing: TrustListing) {
  let score = 50;

  if (listing.isAuthorizedSeller) score += 20;
  if (listing.warrantySupport) score += 10;
  if ((listing.returnWindowDays || 0) >= 30) score += 10;

  if (typeof listing.customerRating === 'number') {
    score += Math.max(-10, Math.min(10, (listing.customerRating - 3.5) * 6));
  }

  if (listing.counterfeitRisk === 'low') score += 10;
  if (listing.counterfeitRisk === 'medium') score -= 10;
  if (listing.counterfeitRisk === 'high') score -= 30;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function describeSellerTrust(listing: TrustListing) {
  const score = calculateSellerTrustScore(listing);
  const signals = [];

  if (listing.isAuthorizedSeller) signals.push('authorized seller');
  if (listing.warrantySupport) signals.push('warranty support');
  if (listing.returnWindowDays) signals.push(`${listing.returnWindowDays}-day returns`);
  if (typeof listing.customerRating === 'number') signals.push(`${listing.customerRating.toFixed(1)} rating`);
  if (listing.counterfeitRisk && listing.counterfeitRisk !== 'unknown') {
    signals.push(`${listing.counterfeitRisk} counterfeit risk`);
  }

  return {
    score,
    label: score >= 80 ? 'strong' : score >= 60 ? 'acceptable' : 'review',
    signals,
  };
}
