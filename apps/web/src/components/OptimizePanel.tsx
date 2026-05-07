import { optimizeCartSplit } from '@/services/api';
import type { CartItem } from '@/stores/cartStore';
import { useMemo, useState } from 'react';

type SplitAssignment = {
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
};

type SplitPlan = {
  assignments: SplitAssignment[];
  storeTotals: Record<string, number>;
  thresholdSavings: Record<string, number>;
  totalCost: number;
  appliedRules?: Record<string, unknown> | null;
  splitPlanId?: string | null;
};

const DEFAULT_THRESHOLDS = [
  { store: 'Amazon', threshold: 35, shippingCost: 6, gapTolerance: 20 },
  { store: 'Walmart', threshold: 35, shippingCost: 6, gapTolerance: 20 },
  { store: 'Target', threshold: 35, shippingCost: 6, gapTolerance: 20 },
  { store: 'BestBuy', threshold: 35, shippingCost: 7, gapTolerance: 20 },
  { store: "Macy's", threshold: 49, shippingCost: 10, gapTolerance: 25 },
];

interface Props {
  items: CartItem[];
  preferredStore?: string;
}

function uniqueStores(items: CartItem[], preferredStore?: string) {
  return Array.from(
    new Set(
      [
        preferredStore,
        ...items.map((item) => item.sourceRetailer),
        ...items.map((item) => item.matchedStore),
      ].filter((store): store is string => Boolean(store))
    )
  );
}

function itemOptions(item: CartItem, stores: string[]) {
  const options: Record<string, Record<string, unknown>> = {};
  for (const store of stores) {
    if (store === item.sourceRetailer) {
      options[store] = {
        price: item.price * item.quantity,
        shipping: 0,
        tax: 0,
        rewards: 0,
        available: true,
        category: item.category,
        matchType: 'exact',
      };
    }
    if (store === item.matchedStore && item.matchedPrice != null) {
      options[store] = {
        price: item.matchedPrice * item.quantity,
        shipping: 0,
        tax: 0,
        rewards: 0,
        available: true,
        category: item.category,
        matchType: item.matchType,
      };
    }
  }
  return options;
}

function buildOptimizerItems(items: CartItem[], stores: string[]) {
  return items.map((item) => ({
    itemId: item.id,
    category: item.category,
    matchType: item.matchType,
    costs: {},
    options: itemOptions(item, stores),
  }));
}

function storeAssignments(plan: SplitPlan) {
  return Object.entries(
    plan.assignments.reduce<Record<string, SplitAssignment[]>>((groups, assignment) => {
      groups[assignment.store] = [...(groups[assignment.store] || []), assignment];
      return groups;
    }, {})
  ).sort(([left], [right]) => left.localeCompare(right));
}

function thresholdSuggestions(plan: SplitPlan) {
  return DEFAULT_THRESHOLDS.map((threshold) => {
    const subtotal = plan.assignments
      .filter((assignment) => assignment.store === threshold.store)
      .reduce((sum, assignment) => sum + assignment.breakdown.price, 0);
    const gap = Math.max(0, threshold.threshold - subtotal);
    if (gap <= 0 || gap > threshold.gapTolerance) return null;
    return {
      store: threshold.store,
      gap,
      shippingCostSaved: threshold.shippingCost,
    };
  }).filter((suggestion): suggestion is { store: string; gap: number; shippingCostSaved: number } => Boolean(suggestion));
}

export default function OptimizePanel({ items, preferredStore }: Props) {
  const [plan, setPlan] = useState<SplitPlan | null>(null);
  const [error, setError] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const stores = useMemo(() => uniqueStores(items, preferredStore), [items, preferredStore]);

  async function optimize() {
    if (items.length === 0 || stores.length === 0) return;
    setIsOptimizing(true);
    setError('');
    try {
      const result = await optimizeCartSplit({
        items: buildOptimizerItems(items, stores),
        userStores: stores,
        shippingThresholds: DEFAULT_THRESHOLDS.filter((threshold) => stores.includes(threshold.store)),
      });
      setPlan(result);
    } catch (optimizeError: any) {
      setError(optimizeError.response?.data?.error || 'Unable to optimize this cart.');
    } finally {
      setIsOptimizing(false);
    }
  }

  const suggestions = plan ? thresholdSuggestions(plan) : [];

  return (
    <section className="rounded-lg bg-white p-5 shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Split Optimizer</h2>
          <p className="text-sm text-gray-500">
            {stores.length > 0 ? `Comparing ${stores.join(', ')}` : 'Add matched or source stores to compare.'}
          </p>
        </div>
        <button
          type="button"
          onClick={optimize}
          disabled={isOptimizing || items.length === 0 || stores.length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isOptimizing ? 'Optimizing...' : 'Optimize'}
        </button>
      </div>

      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      {plan && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-700">
              Total ${plan.totalCost.toFixed(2)}
            </span>
            {plan.appliedRules && (
              <span className="rounded-full bg-cyan-50 px-3 py-1 font-medium text-cyan-700">
                Rules v{String(plan.appliedRules.version || 1)} applied
              </span>
            )}
            {Object.entries(plan.thresholdSavings).map(([store, value]) => (
              <span key={store} className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                {store} shipping saved ${value.toFixed(2)}
              </span>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {storeAssignments(plan).map(([store, assignments]) => (
              <div key={store} className="rounded border border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{store}</h3>
                  <span className="text-sm font-medium">${(plan.storeTotals[store] || 0).toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                  {assignments.map((assignment) => {
                    const item = items.find((cartItem) => cartItem.id === assignment.itemId);
                    return (
                      <div key={assignment.itemId} className="rounded bg-gray-50 p-3 text-sm">
                        <p className="font-medium">{item?.productName || assignment.itemId}</p>
                        <p className="text-gray-600">{assignment.reason}</p>
                        {assignment.ruleViolations && assignment.ruleViolations.length > 0 && (
                          <p className="mt-1 text-red-700">
                            Rules blocked this item: {assignment.ruleViolations.join(', ')}
                          </p>
                        )}
                        {assignment.ruleRejections && assignment.ruleRejections.length > 0 && (
                          <div className="mt-2 rounded border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-950">
                            {assignment.ruleRejections.map((rejection) => (
                              <p key={rejection.store}>
                                {rejection.store}: {rejection.explanations.map((item) => item.explanation).join(' ')}
                              </p>
                            ))}
                          </div>
                        )}
                        <p className="text-gray-500">
                          Price ${assignment.breakdown.price.toFixed(2)}
                          {assignment.breakdown.cardLinkedOffers ? `, offer -$${assignment.breakdown.cardLinkedOffers.toFixed(2)}` : ''}
                        </p>
                        {assignment.cardLinkedOfferCitations && assignment.cardLinkedOfferCitations.length > 0 && (
                          <div className="mt-2 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-950">
                            {assignment.cardLinkedOfferCitations.map((offer) => (
                              <p key={`${offer.description}-${offer.expectedValue}`}>
                                {offer.description}: expected value ${offer.expectedValue.toFixed(2)}, source {offer.sourceName}
                                {offer.expiresAt ? `, expires ${offer.expiresAt}` : ''}
                                {offer.termsSummary ? `. Terms: ${offer.termsSummary}` : ''}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {suggestions.length > 0 && (
            <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-950">
              <p className="font-semibold">Threshold suggestions</p>
              <ul className="mt-2 space-y-1">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.store}>
                    Add ${suggestion.gap.toFixed(2)} at {suggestion.store} to unlock about $
                    {suggestion.shippingCostSaved.toFixed(2)} in shipping savings.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
