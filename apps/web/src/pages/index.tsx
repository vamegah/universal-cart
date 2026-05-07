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
  const matchRate = items.length > 0 ? Math.round((matchedItems / items.length) * 100) : 0;

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
    <div className="space-y-6">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="uc-label">Commerce Operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Universal cart command center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Monitor imported products, retailer matches, savings signals, and checkout readiness from one operational view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/cart" className="uc-button-secondary">
              View cart
            </Link>
            <Link href="/checkout" className="uc-button-primary">
              Review checkout
            </Link>
          </div>
        </div>
      </section>

      {dashboardStatus && (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm font-medium text-cyan-950">
          {dashboardStatus}
        </div>
      )}

      <ImportForm />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="uc-kpi">
          <p className="uc-label">Product groups</p>
          <p className="uc-value">{groups.length}</p>
          <p className="uc-subtle">Normalized shopping entities</p>
        </div>
        <div className="uc-kpi">
          <p className="uc-label">Source retailers</p>
          <p className="uc-value">{sourceRetailers.length}</p>
          <p className="uc-subtle">{sourceRetailers.length > 0 ? sourceRetailers.join(', ') : 'No stores connected'}</p>
        </div>
        <div className="uc-kpi">
          <p className="uc-label">Match coverage</p>
          <p className="uc-value">{matchRate}%</p>
          <p className="uc-subtle">{matchedItems}/{items.length} items matched</p>
        </div>
        <div className="uc-kpi">
          <p className="uc-label">Estimated savings</p>
          <p className="uc-value">${estimatedSavings.toFixed(2)}</p>
          <p className="uc-subtle">After rewards and pricing signals</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="uc-panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="uc-label">Cart Intelligence</p>
                <h2 className="text-lg font-semibold text-slate-950">Product group review</h2>
              </div>
              <Link href="/cart" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
                Open cart
              </Link>
            </div>
          </div>
          {items.length === 0 ? (
            <div className="p-8">
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="font-semibold text-slate-800">No products imported yet</p>
                <p className="mt-1 text-sm text-slate-500">Add a product URL or search catalog results to begin comparing retailers.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {groups.slice(0, 5).map((group) => (
                <div key={group.key} className="px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{group.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {group.totalQuantity} item{group.totalQuantity === 1 ? '' : 's'} from {group.sourceRetailers.join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="uc-pill">{group.matchedCount}/{group.items.length} matched</span>
                      {group.bestEffectiveSavings != null && (
                        <span className="uc-pill text-emerald-700">
                          ${group.bestEffectiveSavings.toFixed(2)} savings
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {groups.length > 5 && (
                <div className="bg-slate-50 px-5 py-3 text-center">
                  <Link href="/cart" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
                    View all {groups.length} product groups
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <Link href="/profile" className="block uc-panel p-4 transition hover:border-cyan-300 hover:shadow-md">
          <p className="uc-label">Preferred match store</p>
          <p className="mt-1 font-semibold text-slate-950">{preferredMatchStore || 'Not set'}</p>
        </Link>
          <Link href="/checkout" className="block uc-panel p-4 transition hover:border-cyan-300 hover:shadow-md">
          <p className="uc-label">Default checkout store</p>
          <p className="mt-1 font-semibold text-slate-950">{defaultCheckoutStore || 'Not set'}</p>
        </Link>
          <Link href="/audit" className="block uc-panel p-4 transition hover:border-cyan-300 hover:shadow-md">
          <p className="uc-label">Audit trail</p>
          <p className="mt-1 font-semibold text-slate-950">View recent cart actions</p>
        </Link>
          <Link href="/analytics" className="block uc-panel p-4 transition hover:border-cyan-300 hover:shadow-md">
          <p className="uc-label">Analytics</p>
          <p className="mt-1 font-semibold text-slate-950">Track commerce KPIs</p>
        </Link>
        </aside>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/lists" className="uc-kpi transition hover:border-cyan-300 hover:shadow-md">
          <p className="uc-label">Saved products</p>
          <p className="uc-value">{dashboardSummary.savedProductCount}</p>
          <p className="uc-subtle">{dashboardSummary.savedListCount} saved list{dashboardSummary.savedListCount === 1 ? '' : 's'}</p>
        </Link>
        <Link href="/alerts" className="uc-kpi transition hover:border-cyan-300 hover:shadow-md">
          <p className="uc-label">Active alerts</p>
          <p className="uc-value">{dashboardSummary.activeAlertCount}</p>
          <p className="uc-subtle">{dashboardSummary.triggeredAlertCount} recently triggered</p>
        </Link>
        <Link href="/cart" className="uc-kpi transition hover:border-cyan-300 hover:shadow-md">
          <p className="uc-label">Transferred products</p>
          <p className="uc-value">{transferredItems}</p>
          <p className="uc-subtle">Matched to another retailer</p>
        </Link>
        <Link href="/checkout" className="uc-kpi transition hover:border-cyan-300 hover:shadow-md">
          <p className="uc-label">Checkout state</p>
          <p className="mt-1 font-semibold text-slate-950">{dashboardSummary.openCheckoutState?.store || defaultCheckoutStore || 'No checkout yet'}</p>
          <p className="uc-subtle">
            {dashboardSummary.openCheckoutState
              ? `${dashboardSummary.openCheckoutState.ready === false ? 'Needs review' : 'Ready or routed'} (${dashboardSummary.openCheckoutState.issueCount} issue${dashboardSummary.openCheckoutState.issueCount === 1 ? '' : 's'})`
              : 'Validate cart readiness'}
          </p>
        </Link>
      </div>

    </div>
  );
}
