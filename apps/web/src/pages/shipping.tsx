import { useCart } from '@/hooks/useCart';
import { estimateShippingRates, optimizeShipping, selectShippingPlan } from '@/services/api';
import { useMemo, useState } from 'react';
import Link from 'next/link';

type ShippingPlan = {
  name: string;
  totalCost: number;
  storeCount: number;
  packageCount: number;
  fastestEtaDays: number | null;
  slowestEtaDays: number | null;
  pickupItemCount: number;
  assignments: Array<{
    itemId: string;
    store: string;
    totalCost: number;
    etaDays: number | null;
    reason: string;
  }>;
};

type ShippingResponse = {
  plans: ShippingPlan[];
  unavailableItems: string[];
  recommendation: string | null;
};

type RateEstimate = {
  retailerName: string;
  speed: string;
  cost: number;
  etaDays: number;
  isFree: boolean;
  source: string;
};

function displayName(name: string) {
  return name.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

export default function ShippingPage() {
  const { items } = useCart();
  const [result, setResult] = useState<ShippingResponse | null>(null);
  const [rates, setRates] = useState<RateEstimate[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [savedPlanName, setSavedPlanName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const optimizerItems = useMemo(() => items.map((item) => {
    const sourceTotal = item.price * item.quantity;
    const matchedTotal = item.matchedPrice != null ? item.matchedPrice * item.quantity : null;
    return {
      itemId: item.id,
      quantity: item.quantity,
      options: [
        {
          store: item.sourceRetailer,
          price: sourceTotal,
          shipping: sourceTotal >= 50 ? 0 : 6.99,
          tax: sourceTotal * 0.08,
          rewards: 0,
          etaDays: item.sourceRetailer === 'Amazon' ? 2 : 5,
          packageCount: 1,
          pickupAvailable: ['Target', 'Walmart', "Macy's", 'Best Buy'].includes(item.sourceRetailer),
          available: true,
        },
        matchedTotal != null && item.matchedStore ? {
          store: item.matchedStore,
          price: matchedTotal,
          shipping: matchedTotal >= 50 ? 0 : 5.99,
          tax: matchedTotal * 0.08,
          rewards: item.pricingComparison?.destination.rewardsValue || 0,
          etaDays: item.matchedStore === 'Amazon' ? 2 : 4,
          packageCount: 1,
          pickupAvailable: ['Target', 'Walmart', "Macy's", 'Best Buy'].includes(item.matchedStore),
          available: true,
        } : null,
      ].filter(Boolean),
    };
  }), [items]);

  // Build rate estimation requests from unique retailers in the cart.
  const rateRequests = useMemo(() => {
    const retailers = new Set<string>();
    items.forEach((item) => {
      retailers.add(item.sourceRetailer);
      if (item.matchedStore) retailers.add(item.matchedStore);
    });
    return Array.from(retailers).map((retailerName) => {
      const subtotal = items
        .filter((i) => i.sourceRetailer === retailerName || i.matchedStore === retailerName)
        .reduce((sum, i) => sum + i.price * i.quantity, 0);
      return { retailerName, subtotal };
    });
  }, [items]);

  async function runOptimizer() {
    setError('');
    setIsBusy(true);
    setSelectedPlan(null);
    setSavedPlanName(null);
    try {
      const [data, rateData] = await Promise.all([
        optimizeShipping(optimizerItems),
        estimateShippingRates(rateRequests).catch(() => []),
      ]);
      setResult(data);
      setRates(rateData);
      if (data.recommendation) setSelectedPlan(data.recommendation);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Unable to optimize shipping.');
    } finally {
      setIsBusy(false);
    }
  }

  async function savePlan() {
    if (!selectedPlan || !result) return;
    const plan = result.plans.find((p) => p.name === selectedPlan);
    if (!plan) return;
    setIsSaving(true);
    try {
      await selectShippingPlan({
        planName: selectedPlan,
        planData: plan,
        totalCost: plan.totalCost,
      });
      setSavedPlanName(selectedPlan);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Unable to save shipping plan.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Shipping Optimizer</h1>

      {items.length === 0 ? (
        <p className="text-gray-500">
          Add items to your <Link href="/cart" className="text-blue-600">cart</Link> before comparing shipping plans.
        </p>
      ) : (
        <section className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-xl font-semibold">Compare Plans</h2>
          <p className="mb-4 text-sm text-gray-500">
            Uses current source and selected match prices to compare low-cost, package-consolidated, and faster delivery paths.
          </p>
          <button
            type="button"
            onClick={runOptimizer}
            disabled={isBusy}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {isBusy ? 'Optimizing...' : 'Optimize shipping'}
          </button>
        </section>
      )}

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

      {/* Carrier rate estimates */}
      {rates.length > 0 && (
        <section className="mb-6 rounded-lg bg-white p-5 shadow">
          <h2 className="mb-3 font-semibold">Estimated carrier rates</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rates.map((rate) => (
              <div key={rate.retailerName} className="rounded border p-3 text-sm">
                <p className="font-medium">{rate.retailerName}</p>
                <p className={rate.isFree ? 'text-green-700 font-medium' : 'text-gray-700'}>
                  {rate.isFree ? 'Free shipping' : `$${rate.cost.toFixed(2)}`} · {rate.etaDays} day{rate.etaDays === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-gray-400">{rate.source === 'estimate' ? 'Estimated' : 'Carrier rate'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {result && (
        <div className="space-y-4">
          {result.recommendation && (
            <div className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              Recommended plan: <strong>{displayName(result.recommendation)}</strong>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {result.plans.map((plan) => (
              <article
                key={plan.name}
                onClick={() => setSelectedPlan(plan.name)}
                className={`cursor-pointer rounded-lg bg-white p-5 shadow transition-all ${
                  selectedPlan === plan.name ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">{displayName(plan.name)}</h2>
                  {selectedPlan === plan.name && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Selected</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="text-gray-500">Total</p>
                  <p className="font-medium">${plan.totalCost.toFixed(2)}</p>
                  <p className="text-gray-500">Stores</p>
                  <p className="font-medium">{plan.storeCount}</p>
                  <p className="text-gray-500">Packages</p>
                  <p className="font-medium">{plan.packageCount}</p>
                  <p className="text-gray-500">ETA</p>
                  <p className="font-medium">
                    {plan.fastestEtaDays == null ? 'N/A' : `${plan.fastestEtaDays}–${plan.slowestEtaDays} days`}
                  </p>
                  <p className="text-gray-500">Pickup items</p>
                  <p className="font-medium">{plan.pickupItemCount}</p>
                </div>
                <div className="mt-4 space-y-2">
                  {plan.assignments.slice(0, 4).map((a) => (
                    <div key={`${plan.name}-${a.itemId}`} className="rounded border p-2 text-xs text-gray-600">
                      <p className="font-medium text-gray-800">{a.store} — ${a.totalCost.toFixed(2)}</p>
                      <p>{a.reason}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {/* Save selected plan */}
          {selectedPlan && (
            <div className="flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="flex-1 text-sm text-blue-900">
                {savedPlanName === selectedPlan
                  ? `✓ ${displayName(selectedPlan)} saved as your shipping plan.`
                  : `Save "${displayName(selectedPlan)}" as your shipping plan?`}
              </p>
              {savedPlanName !== selectedPlan && (
                <button
                  type="button"
                  onClick={savePlan}
                  disabled={isSaving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save plan'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
