import { CartRuleSet, explainOptionViolations, optionPassesRules, optionViolations } from './cartRulesService';
import { calculateCardLinkedOfferValue, getCardLinkedOfferCitations, getCardLinkedOffers } from './loyaltyService';

export interface ItemCost {
  itemId: string;
  category?: string;
  matchType?: string;
  costs: Record<string, number>;
  options?: Record<
    string,
    {
      price?: number;
      shipping?: number;
      tax?: number;
      rewards?: number;
      available?: boolean;
      category?: string;
      matchType?: string;
      isThirdPartySeller?: boolean;
      returnWindowDays?: number | null;
      etaDays?: number | null;
      finalSale?: boolean;
    }
  >;
}

export interface SplitAssignment {
  itemId: string;
  store: string;
  totalCost: number;
  breakdown: {
    price: number;
    shipping: number;
    tax: number;
    rewards: number;
    cardLinkedOffers?: number;
  };
  cardLinkedOfferCitations?: Array<{
    retailerName: string;
    description: string;
    sourceName: string;
    sourceUrl: string | null;
    termsSummary: string | null;
    expiresAt: string | null;
    expectedValue: number;
  }>;
  reason: string;
  ruleViolations?: string[];
  ruleRejections?: Array<{
    store: string;
    violations: string[];
    explanations: Array<{ violation: string; explanation: string }>;
  }>;
}

export interface SplitPlanResult {
  assignments: SplitAssignment[];
  storeTotals: Record<string, number>;
  unavailableItems: string[];
  thresholdSavings: Record<string, number>;
  totalCost: number;
  strategy?: string;
}

/**
 * Free-shipping threshold configuration per store.
 * When a store's subtotal is within `gapTolerance` of `threshold`, the
 * optimizer will attempt to consolidate additional items to that store to
 * eliminate shipping costs across the whole order.
 */
export interface ShippingThreshold {
  store: string;
  threshold: number;    // spend required to unlock free shipping
  shippingCost: number; // shipping cost avoided when threshold is met
  gapTolerance?: number; // how close to threshold to attempt consolidation (default 20)
}

/**
 * Apply free-shipping threshold consolidation.
 *
 * For each store whose subtotal is within `gapTolerance` of its threshold,
 * re-assign items currently at other stores if doing so costs less overall
 * (item price delta < shipping cost saved).
 */
function applyShippingThresholds(
  assignments: SplitAssignment[],
  thresholds: ShippingThreshold[]
): { assignments: SplitAssignment[]; thresholdSavings: Record<string, number> } {
  const result = assignments.map((a) => ({ ...a }));
  const thresholdSavings: Record<string, number> = {};

  for (const threshold of thresholds) {
    const { store, threshold: freeAt, shippingCost, gapTolerance = 20 } = threshold;
    const subtotal = result
      .filter((a) => a.store === store)
      .reduce((sum, a) => sum + (a.breakdown.price ?? a.totalCost), 0);

    if (subtotal >= freeAt) {
      thresholdSavings[store] = shippingCost;
      continue;
    }

    const gap = freeAt - subtotal;
    if (gap > gapTolerance) continue;

    let runningSubtotal = subtotal;
    for (const assignment of result) {
      if (assignment.store === store) continue;
      if (runningSubtotal >= freeAt) break;

      const currentCost = assignment.totalCost;
      const estimatedCostAtStore = assignment.breakdown.price;
      const delta = estimatedCostAtStore - currentCost;

      if (delta < shippingCost) {
        assignment.store = store;
        assignment.totalCost = estimatedCostAtStore;
        assignment.breakdown = { ...assignment.breakdown, shipping: 0 };
        assignment.reason = `Consolidated to ${store} to reach free-shipping threshold ($${freeAt})`;
        runningSubtotal += estimatedCostAtStore;
      }
    }

    if (runningSubtotal >= freeAt) {
      thresholdSavings[store] = shippingCost;
    }
  }

  return { assignments: result, thresholdSavings };
}

function buildPlan(
  assignments: SplitAssignment[],
  unavailableItems: string[],
  thresholdSavings: Record<string, number>,
  strategy: string
): SplitPlanResult {
  const storeTotals = assignments.reduce<Record<string, number>>((totals, assignment) => {
    totals[assignment.store] =
      (totals[assignment.store] || 0) + (Number.isFinite(assignment.totalCost) ? assignment.totalCost : 0);
    return totals;
  }, {});

  return {
    assignments,
    storeTotals,
    unavailableItems,
    thresholdSavings,
    totalCost: assignments.reduce(
      (sum, assignment) => sum + (Number.isFinite(assignment.totalCost) ? assignment.totalCost : 0),
      0
    ),
    strategy,
  };
}

export function optimizeSplit(items: ItemCost[], userStores: string[]): Map<string, string> {
  return new Map(optimizeSplitPlan(items, userStores).assignments.map((a) => [a.itemId, a.store]));
}

function offerValueForStore(preferences: any, store: string, subtotal: number) {
  if (!preferences) return 0;
  return calculateCardLinkedOfferValue(subtotal, getCardLinkedOffers(preferences, store));
}

function offerCitationsForStore(preferences: any, store: string, subtotal: number) {
  if (!preferences) return [];
  return getCardLinkedOfferCitations(subtotal, getCardLinkedOffers(preferences, store));
}

function optionSatisfiesReturnPreferences(option: { returnWindowDays?: number | null; finalSale?: boolean }, preferences: any) {
  const returnPreferences = preferences?.shippingPref?.returnPreferences;
  if (!returnPreferences || typeof returnPreferences !== 'object') return true;

  const minReturnWindowDays = Number(returnPreferences.minReturnWindowDays || 0);
  if (minReturnWindowDays > 0 && (option.returnWindowDays ?? 0) < minReturnWindowDays) return false;
  if (returnPreferences.requireEasyReturns && (option.returnWindowDays ?? 0) < 30) return false;
  if (returnPreferences.avoidFinalSale && option.finalSale === true) return false;
  return true;
}

function costForStore(item: ItemCost, store: string, rules?: CartRuleSet, preferences?: any) {
  const option = item.options?.[store];
  if (option) {
    if (option.available === false) return null;
    if (!optionSatisfiesReturnPreferences(option, preferences)) return null;
    const ruleAwareOption = {
      ...option,
      category: option.category || item.category,
      matchType: option.matchType || item.matchType,
    };
    if (!optionPassesRules(ruleAwareOption, rules)) return null;
    const price = option.price ?? item.costs[store] ?? 0;
    const shipping = option.shipping ?? 0;
    const tax = option.tax ?? 0;
    const rewards = option.rewards ?? 0;
    const cardLinkedOffers = offerValueForStore(preferences, store, price);
    const cardLinkedOfferCitations = offerCitationsForStore(preferences, store, price);
    return {
      totalCost: Math.max(0, price + shipping + tax - rewards - cardLinkedOffers),
      breakdown: { price, shipping, tax, rewards, cardLinkedOffers },
      cardLinkedOfferCitations,
    };
  }

  const cost = item.costs[store];
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  const cardLinkedOffers = offerValueForStore(preferences, store, cost);
  const cardLinkedOfferCitations = offerCitationsForStore(preferences, store, cost);
  return {
    totalCost: Math.max(0, cost - cardLinkedOffers),
    breakdown: { price: cost, shipping: 0, tax: 0, rewards: 0, cardLinkedOffers },
    cardLinkedOfferCitations,
  };
}

function ruleRejectionsForItem(item: ItemCost, stores: string[], rules?: CartRuleSet) {
  if (!rules) return [];

  return stores
    .map((store) => {
      const option = item.options?.[store];
      if (!option || option.available === false) return null;
      const ruleAwareOption = {
        ...option,
        category: option.category || item.category,
        matchType: option.matchType || item.matchType,
      };
      const violations = optionViolations(ruleAwareOption, rules);
      if (violations.length === 0) return null;

      return {
        store,
        violations,
        explanations: explainOptionViolations(ruleAwareOption, rules),
      };
    })
    .filter((rejection): rejection is NonNullable<typeof rejection> => Boolean(rejection));
}

function assignmentReason(store: string, breakdown: SplitAssignment['breakdown']) {
  const offerValue = breakdown.cardLinkedOffers || 0;
  if (offerValue > 0) {
    return `Lowest effective total at ${store} after $${offerValue.toFixed(2)} card-linked offer`;
  }
  return `Lowest effective total at ${store}`;
}

export function optimizeSplitPlan(
  items: ItemCost[],
  userStores: string[],
  rules?: CartRuleSet,
  shippingThresholds?: ShippingThreshold[],
  preferences?: any
): SplitPlanResult {
  const assignments: SplitAssignment[] = [];
  const unavailableItems: string[] = [];

  for (const item of items) {
    let best: SplitAssignment | null = null;
    let bestCost = Infinity;
    for (const store of userStores) {
      const evaluated = costForStore(item, store, rules, preferences);
      if (evaluated && evaluated.totalCost < bestCost) {
        bestCost = evaluated.totalCost;
        best = {
          itemId: item.itemId,
          store,
          totalCost: evaluated.totalCost,
          breakdown: evaluated.breakdown,
          reason: assignmentReason(store, evaluated.breakdown),
          cardLinkedOfferCitations: evaluated.cardLinkedOfferCitations,
          ruleRejections: ruleRejectionsForItem(item, userStores, rules),
        };
      }
    }
    if (best) {
      assignments.push(best);
    } else {
      const violations = Object.values(item.options || {}).flatMap((option) =>
        optionViolations(
          { ...option, category: option.category || item.category, matchType: option.matchType || item.matchType },
          rules
        )
      );
      unavailableItems.push(item.itemId);
      assignments.push({
        itemId: item.itemId,
        store: userStores[0],
        totalCost: Infinity,
        breakdown: { price: 0, shipping: 0, tax: 0, rewards: 0 },
        reason:
          violations.length > 0
            ? 'No option satisfied the active cart rules; assigned to first preferred store for manual review'
            : 'No finite available option found; assigned to first preferred store for manual review',
        ruleViolations: Array.from(new Set(violations)),
        ruleRejections: ruleRejectionsForItem(item, userStores, rules),
      });
    }
  }

  const { assignments: finalAssignments, thresholdSavings } =
    shippingThresholds && shippingThresholds.length > 0
      ? applyShippingThresholds(assignments, shippingThresholds)
      : { assignments, thresholdSavings: {} };

  return buildPlan(finalAssignments, unavailableItems, thresholdSavings, 'greedy');
}

function candidateForStore(item: ItemCost, store: string, rules?: CartRuleSet, preferences?: any): SplitAssignment | null {
  const evaluated = costForStore(item, store, rules, preferences);
  if (!evaluated) return null;

  return {
    itemId: item.itemId,
    store,
    totalCost: evaluated.totalCost,
    breakdown: evaluated.breakdown,
    cardLinkedOfferCitations: evaluated.cardLinkedOfferCitations,
    reason:
      (evaluated.breakdown.cardLinkedOffers || 0) > 0
        ? `Global optimizer selected ${store} with $${evaluated.breakdown.cardLinkedOffers?.toFixed(2)} card-linked offer`
        : `Global optimizer selected ${store}`,
    ruleRejections: ruleRejectionsForItem(item, [store], rules),
  };
}

function applyMetThresholdSavings(assignments: SplitAssignment[], thresholds: ShippingThreshold[]) {
  const result = assignments.map((assignment) => ({
    ...assignment,
    breakdown: { ...assignment.breakdown },
  }));
  const thresholdSavings: Record<string, number> = {};

  for (const threshold of thresholds) {
    const storeAssignments = result.filter((assignment) => assignment.store === threshold.store);
    const subtotal = storeAssignments.reduce((sum, assignment) => sum + assignment.breakdown.price, 0);
    if (subtotal < threshold.threshold) continue;

    const shippingTotal = storeAssignments.reduce((sum, assignment) => sum + assignment.breakdown.shipping, 0);
    const savings = Math.min(shippingTotal, threshold.shippingCost);
    if (savings <= 0) continue;

    let remaining = savings;
    for (const assignment of storeAssignments) {
      if (remaining <= 0) break;
      const reduction = Math.min(assignment.breakdown.shipping, remaining);
      assignment.breakdown.shipping -= reduction;
      assignment.totalCost -= reduction;
      assignment.reason = `${assignment.reason}; ${threshold.store} free-shipping threshold met`;
      remaining -= reduction;
    }
    thresholdSavings[threshold.store] = savings;
  }

  return { assignments: result, thresholdSavings };
}

export function optimizeSplitPlanGlobal(
  items: ItemCost[],
  userStores: string[],
  rules?: CartRuleSet,
  shippingThresholds: ShippingThreshold[] = [],
  preferences?: any
): SplitPlanResult {
  if (items.length > 20) {
    return {
      ...optimizeSplitPlan(items, userStores, rules, shippingThresholds, preferences),
      strategy: 'greedy_fallback_large_cart',
    };
  }

  const unavailableItems: string[] = [];
  const fixedAssignments: SplitAssignment[] = [];
  const variableCandidates: SplitAssignment[][] = [];

  for (const item of items) {
    const candidates = userStores
      .map((store) => candidateForStore(item, store, rules, preferences))
      .filter((candidate): candidate is SplitAssignment => Boolean(candidate));

    if (candidates.length === 0) {
      const violations = Object.values(item.options || {}).flatMap((option) =>
        optionViolations(
          { ...option, category: option.category || item.category, matchType: option.matchType || item.matchType },
          rules
        )
      );
      unavailableItems.push(item.itemId);
      fixedAssignments.push({
        itemId: item.itemId,
        store: userStores[0],
        totalCost: Infinity,
        breakdown: { price: 0, shipping: 0, tax: 0, rewards: 0 },
        reason:
          violations.length > 0
            ? 'No option satisfied the active cart rules; assigned to first preferred store for manual review'
            : 'No finite available option found; assigned to first preferred store for manual review',
        ruleViolations: Array.from(new Set(violations)),
        ruleRejections: ruleRejectionsForItem(item, userStores, rules),
      });
    } else {
      variableCandidates.push(candidates.sort((a, b) => a.totalCost - b.totalCost));
    }
  }

  const greedyPlan = optimizeSplitPlan(items, userStores, rules, shippingThresholds, preferences);
  let bestAssignments = greedyPlan.assignments.filter((assignment) => Number.isFinite(assignment.totalCost));
  let bestCost = greedyPlan.totalCost;
  const maxPotentialThresholdSavings = shippingThresholds.reduce((sum, threshold) => sum + threshold.shippingCost, 0);
  const minRemaining = new Array(variableCandidates.length + 1).fill(0);

  for (let index = variableCandidates.length - 1; index >= 0; index -= 1) {
    minRemaining[index] = minRemaining[index + 1] + variableCandidates[index][0].totalCost;
  }

  function score(assignments: SplitAssignment[]) {
    const thresholdAdjusted =
      shippingThresholds.length > 0
        ? applyMetThresholdSavings(assignments, shippingThresholds).assignments
        : assignments;
    return thresholdAdjusted.reduce((sum, assignment) => sum + assignment.totalCost, 0);
  }

  function visit(index: number, partial: SplitAssignment[], partialCost: number) {
    if (partialCost + minRemaining[index] - maxPotentialThresholdSavings >= bestCost) return;

    if (index === variableCandidates.length) {
      const candidateCost = score(partial);
      if (candidateCost < bestCost) {
        bestCost = candidateCost;
        bestAssignments = partial.map((assignment) => ({ ...assignment, breakdown: { ...assignment.breakdown } }));
      }
      return;
    }

    for (const candidate of variableCandidates[index]) {
      partial.push(candidate);
      visit(index + 1, partial, partialCost + candidate.totalCost);
      partial.pop();
    }
  }

  visit(0, [], 0);

  const withThresholds =
    shippingThresholds.length > 0
      ? applyMetThresholdSavings(bestAssignments, shippingThresholds)
      : { assignments: bestAssignments, thresholdSavings: {} };

  return buildPlan(
    [...fixedAssignments, ...withThresholds.assignments],
    unavailableItems,
    withThresholds.thresholdSavings,
    'global_branch_and_bound'
  );
}

export function getThresholdSuggestions(splitPlan: Pick<SplitPlanResult, 'assignments'>, shippingThresholds: ShippingThreshold[]) {
  return shippingThresholds
    .map((threshold) => {
      const subtotal = splitPlan.assignments
        .filter((assignment) => assignment.store === threshold.store)
        .reduce((sum, assignment) => sum + assignment.breakdown.price, 0);
      const gap = Math.max(0, threshold.threshold - subtotal);
      const gapTolerance = threshold.gapTolerance ?? 20;

      if (gap <= 0 || gap > gapTolerance) return null;

      return {
        store: threshold.store,
        gap,
        shippingCostSaved: threshold.shippingCost,
        message: `Add $${gap.toFixed(2)} at ${threshold.store} to unlock about $${threshold.shippingCost.toFixed(2)} in shipping savings.`,
      };
    })
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion));
}
