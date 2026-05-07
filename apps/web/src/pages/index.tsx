import ImportForm from '@/components/ImportForm';
import { useCart } from '@/hooks/useCart';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { groupCartItems } from '@/utils/cartGrouping';
import { usePreferences } from '@/hooks/usePreferences';
import { getAlerts, getAuditEvents, getSavedLists, getStoredAuthToken } from '@/services/api';
import { summarizeDashboardState } from '@/utils/dashboardSummary';

export default function Home() {
  const { items } = useCart();
  const { preferredMatchStore, defaultCheckoutStore } = usePreferences();
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [dashboardStatus, setDashboardStatus] = useState('');
  const groups = useMemo(() => groupCartItems(items), [items]);
  const matchedItems = items.filter((item) => item.matchedProductId).length;
  const sourceRetailers = Array.from(new Set(items.map((item) => item.sourceRetailer)));
  const transferredItems = items.filter((item) => item.matchedProductId && item.matchedStore && item.matchedStore !== item.sourceRetailer).length;
  const estimatedSavings = items.reduce((sum, item) => {
    const savings = item.pricingComparison?.recommendation.effectiveSavings;
    return sum + (typeof savings === 'number' && savings > 0 ? savings : 0);
  }, 0);
  const dashboardSummary = useMemo(
    () => summarizeDashboardState(savedLists, alerts, auditEvents),
    [savedLists, alerts, auditEvents]
  );

  useEffect(() => {
    if (!getStoredAuthToken()) {
      setDashboardStatus('Sign in to sync saved lists, alerts, and checkout state.');
      return;
    }

    Promise.all([getSavedLists(), getAlerts(), getAuditEvents(20)])
      .then(([lists, alertRows, events]) => {
        setSavedLists(lists || []);
        setAlerts(alertRows || []);
        setAuditEvents(events || []);
        setDashboardStatus('');
      })
      .catch(() => setDashboardStatus('Some dashboard data could not be loaded.'));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Universal Cart Dashboard</h1>
      <ImportForm />
      {dashboardStatus && (
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          {dashboardStatus}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Product groups</p>
          <p className="text-2xl font-bold">{groups.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Source retailers</p>
          <p className="text-2xl font-bold">{sourceRetailers.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Matched items</p>
          <p className="text-2xl font-bold">
            {matchedItems}/{items.length}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Estimated savings</p>
          <p className="text-2xl font-bold">${estimatedSavings.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <Link href="/profile" className="rounded-lg bg-white p-4 shadow hover:shadow-md">
          <p className="text-sm text-gray-500">Preferred match store</p>
          <p className="font-semibold">{preferredMatchStore || 'Not set'}</p>
        </Link>
        <Link href="/checkout" className="rounded-lg bg-white p-4 shadow hover:shadow-md">
          <p className="text-sm text-gray-500">Default checkout store</p>
          <p className="font-semibold">{defaultCheckoutStore || 'Not set'}</p>
        </Link>
        <Link href="/audit" className="rounded-lg bg-white p-4 shadow hover:shadow-md">
          <p className="text-sm text-gray-500">Audit trail</p>
          <p className="font-semibold">View recent cart actions</p>
        </Link>
        <Link href="/analytics" className="rounded-lg bg-white p-4 shadow hover:shadow-md">
          <p className="text-sm text-gray-500">Analytics</p>
          <p className="font-semibold">Track MVP KPIs</p>
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <Link href="/lists" className="rounded-lg bg-white p-4 shadow hover:shadow-md">
          <p className="text-sm text-gray-500">Saved products</p>
          <p className="text-2xl font-bold">{dashboardSummary.savedProductCount}</p>
          <p className="text-sm text-gray-500">{dashboardSummary.savedListCount} saved list{dashboardSummary.savedListCount === 1 ? '' : 's'}</p>
        </Link>
        <Link href="/alerts" className="rounded-lg bg-white p-4 shadow hover:shadow-md">
          <p className="text-sm text-gray-500">Active alerts</p>
          <p className="text-2xl font-bold">{dashboardSummary.activeAlertCount}</p>
          <p className="text-sm text-gray-500">{dashboardSummary.triggeredAlertCount} recently triggered</p>
        </Link>
        <Link href="/cart" className="rounded-lg bg-white p-4 shadow hover:shadow-md">
          <p className="text-sm text-gray-500">Transferred products</p>
          <p className="text-2xl font-bold">{transferredItems}</p>
          <p className="text-sm text-gray-500">Matched to another retailer</p>
        </Link>
        <Link href="/checkout" className="rounded-lg bg-white p-4 shadow hover:shadow-md">
          <p className="text-sm text-gray-500">Checkout state</p>
          <p className="font-semibold">{dashboardSummary.openCheckoutState?.store || defaultCheckoutStore || 'No checkout yet'}</p>
          <p className="text-sm text-gray-500">
            {dashboardSummary.openCheckoutState
              ? `${dashboardSummary.openCheckoutState.ready === false ? 'Needs review' : 'Ready or routed'} (${dashboardSummary.openCheckoutState.issueCount} issue${dashboardSummary.openCheckoutState.issueCount === 1 ? '' : 's'})`
              : 'Validate cart readiness'}
          </p>
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Your Universal Cart ({groups.length} product groups)</h2>
        {items.length === 0 ? (
          <p className="text-gray-500">No items yet. Import a product above.</p>
        ) : (
          <div className="space-y-3">
            {groups.slice(0, 3).map((group) => (
              <div key={group.key} className="rounded-lg bg-white p-4 shadow">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{group.title}</p>
                    <p className="text-sm text-gray-500">
                      {group.totalQuantity} item{group.totalQuantity === 1 ? '' : 's'} from {group.sourceRetailers.join(', ')}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    {group.matchedCount}/{group.items.length} matched
                  </p>
                </div>
              </div>
            ))}
            {groups.length > 3 && (
              <div className="text-center mt-4">
                <Link href="/cart" className="text-blue-600 hover:underline">
                  View all {groups.length} product groups
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
