import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { dispatchAlertNotification } from './alertNotificationService';
import { getExpiringCardOffers, getExpiringPromos } from './loyaltyService';

const PRICE_DROP_THRESHOLD = 0.01; // trigger if price dropped by at least 1 cent

/**
 * Refresh all active alert subscriptions.
 * Called by the price-sync worker on a schedule.
 */
export async function refreshAlerts(): Promise<void> {
  const subscriptions = await prisma.alertSubscription.findMany({
    where: { status: 'active' },
    include: {
      user: { select: { id: true, email: true } },
      product: {
        include: { retailerProducts: { where: { inStock: true } } },
      },
    },
  });

  if (subscriptions.length === 0) return;

  logger.info(`Refreshing ${subscriptions.length} active alert subscriptions`);

  await Promise.allSettled(subscriptions.map(evaluateSubscription));

  // Also check promo and card-offer expiry reminders for all users with preferences.
  await checkExpiryReminders();
}

async function evaluateSubscription(sub: any): Promise<void> {
  try {
    const triggered = checkCondition(sub);
    if (!triggered) return;

    await prisma.alertSubscription.update({
      where: { id: sub.id },
      data: { lastTriggeredAt: new Date() },
    });

    await dispatchAlertNotification({
      userId: sub.user.id,
      userEmail: sub.user.email,
      alertType: sub.alertType,
      productName: sub.product.name,
      alertId: sub.id,
      detail: triggered,
    });
  } catch (error) {
    logger.error(`Failed to evaluate alert ${sub.id}: ${error}`);
  }
}

async function checkExpiryReminders(): Promise<void> {
  const usersWithPrefs = await prisma.userPreferences.findMany({
    where: { shippingPref: { not: Prisma.JsonNull } },
    include: { user: { select: { id: true, email: true } } },
  });

  await Promise.allSettled(
    usersWithPrefs.map(async (pref) => {
      const expiringPromos = getExpiringPromos(pref, 48);
      for (const membership of expiringPromos) {
        await dispatchAlertNotification({
          userId: pref.userId,
          userEmail: pref.user.email,
          alertType: 'promo_expiration',
          productName: membership.retailerName,
          alertId: `promo-${pref.userId}-${membership.retailerName}`,
          detail: `${membership.retailerName} loyalty promo expires at ${membership.promoExpiresAt}`,
        });
      }

      const expiringOffers = getExpiringCardOffers(pref, 48);
      for (const offer of expiringOffers) {
        await dispatchAlertNotification({
          userId: pref.userId,
          userEmail: pref.user.email,
          alertType: 'card_offer',
          productName: offer.retailerName,
          alertId: `card-offer-${pref.userId}-${offer.retailerName}`,
          detail: `Card offer expiring: ${offer.description} at ${offer.retailerName} (expires ${offer.expiresAt})`,
        });
      }
    })
  );
}

/** Returns a human-readable trigger detail string, or null if condition not met. */
function checkCondition(sub: any): string | null {
  const listings: any[] = sub.product.retailerProducts ?? [];

  switch (sub.alertType) {
    case 'price_drop': {
      if (listings.length === 0) return null;
      const lowestPrice = Math.min(...listings.map((l: any) => l.price));
      if (sub.targetPrice != null && lowestPrice <= sub.targetPrice - PRICE_DROP_THRESHOLD) {
        return `Price is now $${lowestPrice.toFixed(2)} (target: $${sub.targetPrice.toFixed(2)})`;
      }
      // No target set — trigger if any listing dropped since last check
      // (without historical tracking we skip this case until price history is added)
      return null;
    }

    case 'restock': {
      const inStockListings = listings.filter((l: any) => l.inStock);
      if (inStockListings.length > 0) {
        const names = inStockListings.map((l: any) => l.retailerName).join(', ');
        return `Now in stock at: ${names}`;
      }
      return null;
    }

    case 'transfer_opportunity': {
      if (listings.length < 2) return null;
      const prices = listings.map((l: any) => ({ name: l.retailerName, price: l.price }));
      prices.sort((a, b) => a.price - b.price);
      const [cheapest, second] = prices;
      if (second.price - cheapest.price >= 1.0) {
        return `${cheapest.name} is $${(second.price - cheapest.price).toFixed(2)} cheaper than ${second.name}`;
      }
      return null;
    }

    case 'promo_expiration': {
      const metadata = sub.metadata as Record<string, any> | null;
      if (!metadata?.promoExpiresAt) return null;
      const expiresAt = new Date(metadata.promoExpiresAt);
      const hoursLeft = (expiresAt.getTime() - Date.now()) / 36e5;
      if (hoursLeft > 0 && hoursLeft <= 48) {
        return `Promo expires in ${Math.ceil(hoursLeft)} hours`;
      }
      return null;
    }

    case 'card_offer': {
      const metadata = sub.metadata as Record<string, any> | null;
      if (!metadata?.cardOfferDetails) return null;
      return `Card offer available: ${metadata.cardOfferDetails}`;
    }

    default:
      return null;
  }
}
