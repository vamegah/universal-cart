export type ShippingOption = {
  store: string;
  price?: number;
  shipping?: number;
  tax?: number;
  rewards?: number;
  etaDays?: number;
  packageCount?: number;
  pickupAvailable?: boolean;
  available?: boolean;
};

export type ShippingItem = {
  itemId: string;
  quantity?: number;
  options: ShippingOption[];
};

type ShippingPlanAssignment = {
  itemId: string;
  store: string;
  totalCost: number;
  etaDays: number | null;
  packageCount: number;
  pickupAvailable: boolean;
  reason: string;
};

function effectiveCost(option: ShippingOption, quantity: number) {
  const price = option.price ?? 0;
  const shipping = option.shipping ?? 0;
  const tax = option.tax ?? 0;
  const rewards = option.rewards ?? 0;
  return price * quantity + shipping + tax - rewards;
}

function optionPackageCount(option: ShippingOption) {
  return Math.max(1, option.packageCount ?? 1);
}

function availableOptions(item: ShippingItem) {
  return (item.options || []).filter((option) => option.available !== false && option.store);
}

function chooseCostFirst(item: ShippingItem) {
  const quantity = item.quantity ?? 1;
  return availableOptions(item).sort((a, b) => effectiveCost(a, quantity) - effectiveCost(b, quantity))[0] || null;
}

function chooseFastest(item: ShippingItem) {
  const quantity = item.quantity ?? 1;
  return availableOptions(item).sort((a, b) => {
    const etaDiff = (a.etaDays ?? Number.MAX_SAFE_INTEGER) - (b.etaDays ?? Number.MAX_SAFE_INTEGER);
    if (etaDiff !== 0) return etaDiff;
    if (a.pickupAvailable !== b.pickupAvailable) return a.pickupAvailable ? -1 : 1;
    return effectiveCost(a, quantity) - effectiveCost(b, quantity);
  })[0] || null;
}

function chooseFewestPackages(items: ShippingItem[]) {
  const storeScores = new Map<string, { count: number; totalCost: number }>();

  for (const item of items) {
    const quantity = item.quantity ?? 1;
    for (const option of availableOptions(item)) {
      const score = storeScores.get(option.store) || { count: 0, totalCost: 0 };
      score.count += 1;
      score.totalCost += effectiveCost(option, quantity);
      storeScores.set(option.store, score);
    }
  }

  const preferredStores = Array.from(storeScores.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return a[1].totalCost - b[1].totalCost;
  });

  return new Map(preferredStores.map(([store], index) => [store, index]));
}

function buildAssignment(item: ShippingItem, option: ShippingOption, reason: string): ShippingPlanAssignment {
  const quantity = item.quantity ?? 1;
  return {
    itemId: item.itemId,
    store: option.store,
    totalCost: effectiveCost(option, quantity),
    etaDays: option.etaDays ?? null,
    packageCount: optionPackageCount(option),
    pickupAvailable: Boolean(option.pickupAvailable),
    reason,
  };
}

function summarizePlan(name: string, assignments: ShippingPlanAssignment[]) {
  const stores = new Set(assignments.map((assignment) => assignment.store));
  const finiteEta = assignments
    .map((assignment) => assignment.etaDays)
    .filter((eta): eta is number => typeof eta === 'number' && Number.isFinite(eta));

  return {
    name,
    assignments,
    totalCost: assignments.reduce((sum, assignment) => sum + assignment.totalCost, 0),
    storeCount: stores.size,
    packageCount: assignments.reduce((sum, assignment) => sum + assignment.packageCount, 0),
    fastestEtaDays: finiteEta.length > 0 ? Math.min(...finiteEta) : null,
    slowestEtaDays: finiteEta.length > 0 ? Math.max(...finiteEta) : null,
    pickupItemCount: assignments.filter((assignment) => assignment.pickupAvailable).length,
  };
}

export function optimizeShippingPlans(items: ShippingItem[]) {
  const eligibleItems = items.filter((item) => item.itemId && availableOptions(item).length > 0);
  const unavailableItems = items.filter((item) => item.itemId && availableOptions(item).length === 0).map((item) => item.itemId);
  const storePreference = chooseFewestPackages(eligibleItems);

  const costAssignments = eligibleItems
    .map((item) => chooseCostFirst(item))
    .map((option, index) => option ? buildAssignment(eligibleItems[index], option, 'Lowest effective cost including shipping') : null)
    .filter((assignment): assignment is ShippingPlanAssignment => Boolean(assignment));

  const fastestAssignments = eligibleItems
    .map((item) => chooseFastest(item))
    .map((option, index) => option ? buildAssignment(eligibleItems[index], option, 'Fastest ETA, then pickup, then cost') : null)
    .filter((assignment): assignment is ShippingPlanAssignment => Boolean(assignment));

  const fewestPackageAssignments = eligibleItems.map((item) => {
    const quantity = item.quantity ?? 1;
    const option = availableOptions(item).sort((a, b) => {
      const storeDiff = (storePreference.get(a.store) ?? 999) - (storePreference.get(b.store) ?? 999);
      if (storeDiff !== 0) return storeDiff;
      const packageDiff = optionPackageCount(a) - optionPackageCount(b);
      if (packageDiff !== 0) return packageDiff;
      return effectiveCost(a, quantity) - effectiveCost(b, quantity);
    })[0];
    return buildAssignment(item, option, 'Consolidates items into fewer stores/packages where possible');
  });

  const plans = [
    summarizePlan('cost_first', costAssignments),
    summarizePlan('fewest_packages', fewestPackageAssignments),
    summarizePlan('fastest_delivery', fastestAssignments),
  ];

  return {
    plans,
    unavailableItems,
    recommendation: plans.slice().sort((a, b) => {
      if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost;
      if (a.packageCount !== b.packageCount) return a.packageCount - b.packageCount;
      return (a.slowestEtaDays ?? 999) - (b.slowestEtaDays ?? 999);
    })[0]?.name || null,
  };
}
