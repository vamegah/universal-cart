import { prisma } from '../index';

type AnalyticsEvent = {
  action: string;
  createdAt: Date | string;
  metadata?: any;
};

type AnalyticsCart = {
  id?: string;
  userId?: string;
  status: string;
  items?: Array<{
    quantity: number;
    sourceRetailer: string;
    matchResults?: Array<{ isSelected: boolean }>;
  }>;
  splitPlans?: Array<unknown>;
};

type AnalyticsUserCard = {
  financingTerms?: any;
};

type AnalyticsUser = {
  id: string;
  createdAt: Date | string;
};

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function startOfDay(value: Date | string) {
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
}

function hasFinancingTerms(card: AnalyticsUserCard) {
  return Boolean(card.financingTerms && typeof card.financingTerms === 'object');
}

function getUniqueUserDays(events: Array<AnalyticsEvent & { userId?: string }>) {
  return new Set(
    events
      .map((event) => event.userId ? `${event.userId}:${startOfDay(event.createdAt)}` : startOfDay(event.createdAt))
      .filter(Boolean)
  ).size;
}

export function summarizeUserAnalytics(events: AnalyticsEvent[], carts: AnalyticsCart[], cards: AnalyticsUserCard[] = []) {
  const importedEvents = events.filter((event) => event.action === 'product.imported');
  const matchGeneratedEvents = events.filter((event) => event.action === 'match.generated');
  const matchNotFoundEvents = events.filter((event) => event.action === 'match.not_found');
  const checkoutRedirectEvents = events.filter((event) => event.action === 'checkout.redirect_created');
  const checkoutValidatedEvents = events.filter((event) => event.action === 'checkout.validated');
  const financingViewedEvents = events.filter((event) => event.action === 'checkout.financing_options_viewed');

  const cartItems = carts.flatMap((cart) => cart.items || []);
  const selectedMatches = cartItems.filter((item) => item.matchResults?.some((match) => match.isSelected));
  const uniqueActiveDays = new Set(events.map((event) => startOfDay(event.createdAt))).size;
  const cartsWithSplitPlans = carts.filter((cart) => (cart.splitPlans || []).length > 0).length;
  const importedRetailers = importedEvents
    .map((event) => event.metadata?.sourceRetailer)
    .filter((retailer): retailer is string => typeof retailer === 'string' && retailer.length > 0);

  const successfulMatches = matchGeneratedEvents.length;
  const attemptedMatches = successfulMatches + matchNotFoundEvents.length;
  const checkoutAttempts = checkoutValidatedEvents.length;
  const checkoutCompletions = checkoutRedirectEvents.length;
  const financingEligibleCards = cards.filter(hasFinancingTerms).length;

  return {
    kpis: {
      cartImportCount: importedEvents.length,
      matchAccuracy: attemptedMatches > 0 ? successfulMatches / attemptedMatches : null,
      cartTransferConversion: checkoutAttempts > 0 ? checkoutCompletions / checkoutAttempts : null,
      checkoutCompletionRate: checkoutAttempts > 0 ? checkoutCompletions / checkoutAttempts : null,
      financingUtilizationRate: checkoutAttempts > 0 ? financingViewedEvents.length / checkoutAttempts : null,
      splitCartAdoptionRate: carts.length > 0 ? cartsWithSplitPlans / carts.length : null,
      dailyActiveDays: uniqueActiveDays,
      activeCartCount: carts.filter((cart) => cart.status === 'active').length,
      cartItemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      matchedCartItemCount: selectedMatches.length,
      cartsWithSplitPlans,
      financingEligibleCardCount: financingEligibleCards,
    },
    breakdowns: {
      actions: countBy(events.map((event) => event.action)),
      importedRetailers: countBy(importedRetailers),
      sourceRetailers: countBy(cartItems.map((item) => item.sourceRetailer).filter(Boolean)),
    },
    recentActivity: events.slice(0, 10).map((event) => ({
      action: event.action,
      createdAt: event.createdAt,
      metadata: event.metadata || null,
    })),
  };
}

export async function getUserAnalytics(userId: string) {
  const [events, carts, cards] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.universalCart.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            matchResults: true,
          },
        },
        splitPlans: true,
      },
    }),
    prisma.userCard.findMany({
      where: { userId },
      select: { financingTerms: true },
    }),
  ]);

  return summarizeUserAnalytics(events, carts, cards);
}

export function summarizeGlobalAnalytics(
  events: Array<AnalyticsEvent & { userId?: string }>,
  carts: AnalyticsCart[],
  cards: AnalyticsUserCard[],
  users: AnalyticsUser[]
) {
  const userSummary = summarizeUserAnalytics(events, carts, cards);
  const checkoutAttempts = events.filter((event) => event.action === 'checkout.validated').length;
  const checkoutCompletions = events.filter((event) => event.action === 'checkout.redirect_created').length;
  const financingViews = events.filter((event) => event.action === 'checkout.financing_options_viewed').length;
  const splitPlanCount = carts.reduce((sum, cart) => sum + (cart.splitPlans || []).length, 0);

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      ...userSummary.kpis,
      totalUsers: users.length,
      dailyActiveUsers: getUniqueUserDays(events),
      checkoutAttempts,
      checkoutCompletions,
      splitPlanCount,
      financingOptionViews: financingViews,
    },
    breakdowns: userSummary.breakdowns,
    recentActivity: userSummary.recentActivity,
  };
}

export async function getGlobalAnalytics() {
  const [events, carts, cards, users] = await Promise.all([
    prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    prisma.universalCart.findMany({
      include: {
        items: {
          include: {
            matchResults: true,
          },
        },
        splitPlans: true,
      },
    }),
    prisma.userCard.findMany({
      select: { financingTerms: true },
    }),
    prisma.user.findMany({
      select: { id: true, createdAt: true },
    }),
  ]);

  return summarizeGlobalAnalytics(events, carts, cards, users);
}
