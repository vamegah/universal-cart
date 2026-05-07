import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CartItem } from '@/stores/cartStore';

interface Props {
  items: CartItem[];
  preferredStore: string;
}

type TransferDecision = 'transfer' | 'keep' | 'pending';

function classifyItem(item: CartItem): 'exact' | 'substitute' | 'unavailable' {
  if (!item.matchedStore || !item.matchedProductId) return 'unavailable';
  if (item.matchType === 'exact') return 'exact';
  return 'substitute';
}

function savingsLabel(item: CartItem): string | null {
  const savings = item.pricingComparison?.recommendation?.effectiveSavings;
  if (savings == null) return null;
  if (savings > 0) return `Save $${savings.toFixed(2)}`;
  if (savings < 0) return `$${Math.abs(savings).toFixed(2)} more`;
  return 'Same price';
}

export default function TransferRecommendation({ items, preferredStore }: Props) {
  const [decisions, setDecisions] = useState<Record<string, TransferDecision>>({});

  const classified = useMemo(
    () => items.map((item) => ({ item, classification: classifyItem(item) })),
    [items]
  );

  const exactItems = classified.filter((c) => c.classification === 'exact');
  const substituteItems = classified.filter((c) => c.classification === 'substitute');
  const unavailableItems = classified.filter((c) => c.classification === 'unavailable');

  function decide(itemId: string, decision: TransferDecision) {
    setDecisions((prev) => ({ ...prev, [itemId]: decision }));
  }

  function approveAll(classification: 'exact' | 'substitute') {
    const updates: Record<string, TransferDecision> = {};
    classified
      .filter((c) => c.classification === classification)
      .forEach(({ item }) => { updates[item.id] = 'transfer'; });
    setDecisions((prev) => ({ ...prev, ...updates }));
  }

  function keepAll(classification: 'exact' | 'substitute') {
    const updates: Record<string, TransferDecision> = {};
    classified
      .filter((c) => c.classification === classification)
      .forEach(({ item }) => { updates[item.id] = 'keep'; });
    setDecisions((prev) => ({ ...prev, ...updates }));
  }

  const transferCount = Object.values(decisions).filter((d) => d === 'transfer').length;
  const pendingCount = classified.filter(
    (c) => c.classification !== 'unavailable' && !decisions[c.item.id]
  ).length;
  const allDecided = pendingCount === 0 && (exactItems.length + substituteItems.length) > 0;

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-semibold mb-1">Transfer to {preferredStore}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Review each item and decide whether to transfer it to {preferredStore} or keep it at the source retailer.
        </p>

        {/* Summary bar */}
        <div className="mb-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-lg bg-green-50 p-3">
            <p className="text-2xl font-bold text-green-700">{exactItems.length}</p>
            <p className="text-green-700">Exact match</p>
          </div>
          <div className="rounded-lg bg-yellow-50 p-3">
            <p className="text-2xl font-bold text-yellow-700">{substituteItems.length}</p>
            <p className="text-yellow-700">Substitute</p>
          </div>
          <div className="rounded-lg bg-gray-100 p-3">
            <p className="text-2xl font-bold text-gray-500">{unavailableItems.length}</p>
            <p className="text-gray-500">Unavailable</p>
          </div>
        </div>

        {/* Exact matches */}
        {exactItems.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-green-700">Exact matches</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => approveAll('exact')}
                  className="rounded border border-green-300 px-3 py-1 text-xs text-green-700 hover:bg-green-50"
                >
                  Transfer all
                </button>
                <button
                  type="button"
                  onClick={() => keepAll('exact')}
                  className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Keep all at source
                </button>
              </div>
            </div>
            <div className="divide-y rounded border">
              {exactItems.map(({ item }) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  decision={decisions[item.id] ?? 'pending'}
                  onDecide={(d) => decide(item.id, d)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Substitutes */}
        {substituteItems.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-yellow-700">Substitute matches — review before approving</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => approveAll('substitute')}
                  className="rounded border border-yellow-300 px-3 py-1 text-xs text-yellow-700 hover:bg-yellow-50"
                >
                  Approve all substitutes
                </button>
                <button
                  type="button"
                  onClick={() => keepAll('substitute')}
                  className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Keep all at source
                </button>
              </div>
            </div>
            <div className="divide-y rounded border">
              {substituteItems.map(({ item }) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  decision={decisions[item.id] ?? 'pending'}
                  onDecide={(d) => decide(item.id, d)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Unavailable */}
        {unavailableItems.length > 0 && (
          <section className="mb-6">
            <h3 className="font-medium text-gray-500 mb-2">Not available at {preferredStore}</h3>
            <div className="divide-y rounded border bg-gray-50">
              {unavailableItems.map(({ item }) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm text-gray-500">
                  <span>{item.productName}</span>
                  <span className="text-xs">Stays at {item.sourceRetailer}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Proceed */}
        {allDecided && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900 mb-3">
              {transferCount} item{transferCount === 1 ? '' : 's'} selected for transfer to {preferredStore}.
              {unavailableItems.length > 0 && ` ${unavailableItems.length} item${unavailableItems.length === 1 ? '' : 's'} will stay at source.`}
            </p>
            <Link
              href="/checkout"
              className="inline-block rounded bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700"
            >
              Proceed to checkout
            </Link>
          </div>
        )}

        {!allDecided && (exactItems.length + substituteItems.length) > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            {pendingCount} item{pendingCount === 1 ? '' : 's'} still need a decision.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── per-item row ─────────────────────────────────────────────────────────────

function ItemRow({
  item,
  decision,
  onDecide,
}: {
  item: CartItem;
  decision: TransferDecision;
  onDecide: (d: TransferDecision) => void;
}) {
  const savings = savingsLabel(item);
  const confidence = item.confidence != null ? Math.round(item.confidence * 100) : null;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.productName}</p>
        <p className="text-xs text-gray-500">
          {item.sourceRetailer} → {item.matchedStore}
          {confidence != null && <span className="ml-1">({confidence}% confidence)</span>}
          {savings && (
            <span className={`ml-2 font-medium ${savings.startsWith('Save') ? 'text-green-700' : savings === 'Same price' ? 'text-gray-500' : 'text-red-600'}`}>
              {savings}
            </span>
          )}
        </p>
        {item.matchedUrl && (
          <a
            href={item.matchedUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            View at {item.matchedStore}
          </a>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onDecide('transfer')}
          className={`rounded px-3 py-1 text-xs font-medium border transition-colors ${
            decision === 'transfer'
              ? 'bg-green-600 text-white border-green-600'
              : 'border-green-300 text-green-700 hover:bg-green-50'
          }`}
        >
          Transfer
        </button>
        <button
          type="button"
          onClick={() => onDecide('keep')}
          className={`rounded px-3 py-1 text-xs font-medium border transition-colors ${
            decision === 'keep'
              ? 'bg-gray-600 text-white border-gray-600'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Keep at source
        </button>
      </div>
    </div>
  );
}
