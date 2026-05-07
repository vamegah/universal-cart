export type CategoryBonus = {
  category: string;   // e.g. 'electronics', 'grocery'
  multiplier: number; // e.g. 5 means 5x points on this category
};

export type CardLinkedOffer = {
  retailerName: string;
  description: string;
  sourceName?: string;
  sourceUrl?: string;
  termsSummary?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;       // percent (0-100) or fixed dollar amount
  minSpend?: number;           // minimum spend to activate
  maxDiscount?: number;        // cap on fixed/percent savings
  expiresAt?: string;          // ISO date string
  activated: boolean;          // user has activated the offer
};

export type LoyaltyMembership = {
  retailerName: string;
  membershipId?: string;
  pointsRate?: number;
  pointValueCents?: number;
  thresholdSpend?: number | null;
  thresholdReward?: number | null;
  promoExpiresAt?: string;
  categoryBonuses?: CategoryBonus[];
  statementCreditRate?: number; // fraction of spend returned as statement credit (e.g. 0.02 = 2%)
};

function normalizeRetailer(value: string) {
  return value.trim().toLowerCase();
}

export function getLoyaltyMembership(preferences: any, retailerName: string): LoyaltyMembership | null {
  const memberships = preferences?.shippingPref?.loyaltyMemberships;
  if (!Array.isArray(memberships)) return null;

  return (
    memberships.find((membership: any) =>
      typeof membership?.retailerName === 'string' &&
      normalizeRetailer(membership.retailerName) === normalizeRetailer(retailerName)
    ) || null
  );
}

export function getCardLinkedOffers(preferences: any, retailerName: string): CardLinkedOffer[] {
  const offers: CardLinkedOffer[] = preferences?.shippingPref?.cardLinkedOffers ?? [];
  return offers.filter(
    (offer) =>
      normalizeRetailer(offer.retailerName) === normalizeRetailer(retailerName) &&
      offer.activated
  );
}

export function calculateCardLinkedOfferValue(subtotal: number, offers: CardLinkedOffer[]): number {
  let total = 0;
  for (const offer of offers) {
    if (offer.minSpend != null && subtotal < offer.minSpend) continue;
    let value =
      offer.discountType === 'percent'
        ? subtotal * (offer.discountValue / 100)
        : offer.discountValue;
    if (offer.maxDiscount != null) value = Math.min(value, offer.maxDiscount);
    total += Math.max(0, value);
  }
  return Math.round(total * 100) / 100;
}

export function getCardLinkedOfferCitations(subtotal: number, offers: CardLinkedOffer[]) {
  return offers
    .map((offer) => {
      if (offer.minSpend != null && subtotal < offer.minSpend) return null;
      let expectedValue =
        offer.discountType === 'percent'
          ? subtotal * (offer.discountValue / 100)
          : offer.discountValue;
      if (offer.maxDiscount != null) expectedValue = Math.min(expectedValue, offer.maxDiscount);
      expectedValue = Math.round(Math.max(0, expectedValue) * 100) / 100;
      if (expectedValue <= 0) return null;

      return {
        retailerName: offer.retailerName,
        description: offer.description,
        sourceName: offer.sourceName || 'user-entered offer',
        sourceUrl: offer.sourceUrl || null,
        termsSummary: offer.termsSummary || null,
        expiresAt: offer.expiresAt || null,
        expectedValue,
      };
    })
    .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer));
}

export function calculateLoyaltyValue(
  subtotal: number,
  membership: LoyaltyMembership | null,
  category?: string
) {
  if (!membership) {
    return { pointsEarned: 0, pointsValue: 0, thresholdValue: 0, statementCreditValue: 0, totalValue: 0, details: [] };
  }

  // Base points rate, boosted by category bonus if applicable.
  let pointsRate = Number(membership.pointsRate || 0);
  if (category && Array.isArray(membership.categoryBonuses)) {
    const bonus = membership.categoryBonuses.find(
      (b) => normalizeRetailer(b.category) === normalizeRetailer(category)
    );
    if (bonus) pointsRate = pointsRate * bonus.multiplier;
  }

  const pointValueCents = Number(membership.pointValueCents || 0);
  const pointsEarned = Math.max(0, subtotal * pointsRate);
  const pointsValue = pointsEarned * (Math.max(0, pointValueCents) / 100);

  const thresholdSpend = Number(membership.thresholdSpend || 0);
  const thresholdReward = Number(membership.thresholdReward || 0);
  const thresholdValue = thresholdSpend > 0 && subtotal >= thresholdSpend ? Math.max(0, thresholdReward) : 0;

  const statementCreditRate = Number(membership.statementCreditRate || 0);
  const statementCreditValue = Math.max(0, subtotal * statementCreditRate);

  const details: string[] = [];
  if (pointsEarned > 0) {
    const label = category && Array.isArray(membership.categoryBonuses) &&
      membership.categoryBonuses.some((b) => normalizeRetailer(b.category) === normalizeRetailer(category))
      ? `${Math.round(pointsEarned)} points (category bonus)`
      : `${Math.round(pointsEarned)} points`;
    details.push(label);
  }
  if (thresholdValue > 0) details.push(`$${thresholdValue.toFixed(2)} threshold reward`);
  if (statementCreditValue > 0) details.push(`$${statementCreditValue.toFixed(2)} statement credit`);
  if (membership.promoExpiresAt) details.push(`promo expires ${membership.promoExpiresAt}`);

  return {
    pointsEarned,
    pointsValue,
    thresholdValue,
    statementCreditValue: Math.round(statementCreditValue * 100) / 100,
    totalValue: pointsValue + thresholdValue + statementCreditValue,
    details,
  };
}

/** Returns memberships whose promos expire within the next `withinHours` hours. */
export function getExpiringPromos(preferences: any, withinHours = 48): LoyaltyMembership[] {
  const memberships: LoyaltyMembership[] = preferences?.shippingPref?.loyaltyMemberships ?? [];
  const cutoff = Date.now() + withinHours * 36e5;
  return memberships.filter((m) => {
    if (!m.promoExpiresAt) return false;
    const exp = new Date(m.promoExpiresAt).getTime();
    return exp > Date.now() && exp <= cutoff;
  });
}

/** Returns activated card-linked offers expiring within `withinHours` hours. */
export function getExpiringCardOffers(preferences: any, withinHours = 48): CardLinkedOffer[] {
  const offers: CardLinkedOffer[] = preferences?.shippingPref?.cardLinkedOffers ?? [];
  const cutoff = Date.now() + withinHours * 36e5;
  return offers.filter((o) => {
    if (!o.expiresAt || !o.activated) return false;
    const exp = new Date(o.expiresAt).getTime();
    return exp > Date.now() && exp <= cutoff;
  });
}
