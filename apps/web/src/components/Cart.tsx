import CartGroup from '@/components/CartGroup';
import MatchSelector from '@/components/MatchSelector';
import OptimizePanel from '@/components/OptimizePanel';
import TransferRecommendation from '@/components/TransferRecommendation';
import { useCart } from '@/hooks/useCart';
import { usePreferences } from '@/hooks/usePreferences';
import { groupCartItems } from '@/utils/cartGrouping';
import Link from 'next/link';
import { useMemo, useState } from 'react';

function CartSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="uc-panel p-5">
          <div className="h-4 w-2/5 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-3/5 rounded bg-slate-100" />
          <div className="mt-5 grid gap-3 sm:grid-cols-[80px_1fr_160px]">
            <div className="h-20 rounded bg-slate-100" />
            <div className="space-y-2">
              <div className="h-3 rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
            <div className="h-9 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Cart() {
  const { items, clearCart, isHydrating } = useCart();
  const { preferredMatchStore } = usePreferences();
  const [matchCompleted, setMatchCompleted] = useState(false);

  const groups = useMemo(() => groupCartItems(items), [items]);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const matchedItems = items.filter((item) => item.matchedProductId).length;
  const sourceRetailers = Array.from(new Set(items.map((item) => item.sourceRetailer))).sort();
  const groupedDuplicateCount = groups.filter((group) => group.items.length > 1 || group.sourceRetailers.length > 1).length;

  if (isHydrating && items.length === 0) {
    return <CartSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="uc-panel p-10 text-center">
        <h2 className="text-xl font-semibold text-slate-950">Your cart is empty</h2>
        <p className="mt-2 text-sm text-slate-500">Import a product from the dashboard to start comparing stores.</p>
        <Link href="/" className="uc-button-primary mt-5">
          Add products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="uc-kpi">
          <p className="uc-label">Product groups</p>
          <p className="uc-value">{groups.length}</p>
        </div>
        <div className="uc-kpi">
          <p className="uc-label">Matched items</p>
          <p className="uc-value">
            {matchedItems}/{items.length}
          </p>
        </div>
        <div className="uc-kpi">
          <p className="uc-label">Grouped duplicates</p>
          <p className="uc-value">{groupedDuplicateCount}</p>
        </div>
        <div className="uc-kpi">
          <p className="uc-label">Estimated total</p>
          <p className="uc-value">${total.toFixed(2)}</p>
        </div>
      </div>

      <div className="uc-panel p-4">
        <p className="uc-label">Source retailers</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {sourceRetailers.map((retailer) => (
            <span key={retailer} className="uc-pill">
              {retailer}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <CartGroup key={group.key} group={group} />
        ))}
      </div>

      <div className="uc-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="uc-label">Cart total</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">${total.toFixed(2)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={clearCart} className="uc-button-danger">
            Clear cart
          </button>
          <Link href="/checkout" className="uc-button-primary">
            Proceed to checkout
          </Link>
        </div>
      </div>

      <OptimizePanel items={items} preferredStore={preferredMatchStore || undefined} />

      <MatchSelector onMatchComplete={() => setMatchCompleted(true)} />

      {matchCompleted && (
        <TransferRecommendation
          items={items}
          preferredStore={preferredMatchStore || 'your preferred store'}
        />
      )}
    </div>
  );
}
