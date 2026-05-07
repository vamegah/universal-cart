import React, { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { recommendShoppingCopilot } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';

const STORES = ['Amazon', 'Walmart', 'Target', "Macy's", 'Best Buy'];

function itemToCopilotCost(item: any) {
  const sourceCost = Number(item.price || 0) * Number(item.quantity || 1);
  const matchedCost = item.matchedPrice != null ? Number(item.matchedPrice) * Number(item.quantity || 1) : undefined;
  const costs: Record<string, number> = {
    [item.sourceRetailer]: sourceCost,
  };
  const options: Record<string, any> = {
    [item.sourceRetailer]: {
      price: sourceCost,
      available: true,
      category: item.category,
      matchType: 'exact',
      returnWindowDays: 30,
    },
  };

  if (item.matchedStore && matchedCost != null) {
    costs[item.matchedStore] = matchedCost;
    options[item.matchedStore] = {
      price: matchedCost,
      available: true,
      category: item.category,
      matchType: item.matchType,
      returnWindowDays: 30,
      isThirdPartySeller: item.sellerTrustLabel === 'limited',
    };
  }

  return {
    itemId: item.id,
    category: item.category,
    matchType: item.matchType,
    costs,
    options,
  };
}

export default function CopilotPage() {
  const { items } = useCartStore();
  const [command, setCommand] = useState("move everything possible to stores where I can use my Macy's card");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const copilotItems = useMemo(() => items.map(itemToCopilotCost), [items]);

  async function runCopilot() {
    setIsLoading(true);
    setError('');
    try {
      const recommendation = await recommendShoppingCopilot({
        command,
        items: copilotItems,
        userStores: STORES,
      });
      setResult(recommendation);
    } catch (runError: any) {
      setError(runError.response?.data?.error || 'Unable to generate recommendations.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Shopping Copilot</h1>
          <p className="text-sm text-gray-600">Recommendations stay pending until you confirm them.</p>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">Command</label>
          <textarea
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            className="mt-2 min-h-24 w-full rounded border px-3 py-2"
          />
          <button
            onClick={runCopilot}
            disabled={isLoading || !command.trim() || copilotItems.length === 0}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {isLoading ? 'Reviewing...' : 'Generate Recommendations'}
          </button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {result && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Review Required</h2>
              <p className="text-sm text-gray-700">{result.confirmation.message}</p>
              <p className="mt-2 text-sm text-gray-600">
                Pending: {result.summary.pendingCount} · Blocked: {result.summary.blockedCount}
              </p>
            </div>

            <div className="grid gap-3">
              {result.recommendations.map((recommendation: any) => (
                <div key={recommendation.itemId} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{recommendation.itemId}</p>
                      <p className="text-sm text-gray-600">{recommendation.reason}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {recommendation.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">
                    {recommendation.action === 'transfer_item'
                      ? `Pending transfer to ${recommendation.store}`
                      : 'Manual review needed'}
                    {recommendation.totalCost != null ? ` · $${recommendation.totalCost.toFixed(2)}` : ''}
                  </p>
                  {recommendation.ruleViolations.length > 0 && (
                    <p className="mt-2 text-sm text-amber-700">{recommendation.ruleViolations.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
