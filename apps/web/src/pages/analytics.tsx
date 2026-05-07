import { getAnalytics } from '@/services/api';
import { useEffect, useState } from 'react';

type AnalyticsResponse = {
  kpis: Record<string, number | null>;
  breakdowns: {
    actions: Record<string, number>;
    importedRetailers: Record<string, number>;
    sourceRetailers: Record<string, number>;
  };
  recentActivity: Array<{
    action: string;
    createdAt: string;
  }>;
};

function percent(value: number | null | undefined) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'N/A';
}

function numberValue(value: number | null | undefined) {
  return typeof value === 'number' ? value.toLocaleString() : 'N/A';
}

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <section className="rounded-lg bg-white p-5 shadow">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([label, count]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAnalytics()
      .then(setAnalytics)
      .catch((loadError: any) => {
        setError(loadError.response?.status === 401 ? 'Sign in to view analytics.' : 'Unable to load analytics.');
      });
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Analytics</h1>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      {!analytics ? (
        <p className="text-gray-500">Loading analytics...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Imports</p>
              <p className="text-2xl font-bold">{numberValue(analytics.kpis.cartImportCount)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Match accuracy</p>
              <p className="text-2xl font-bold">{percent(analytics.kpis.matchAccuracy)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Checkout conversion</p>
              <p className="text-2xl font-bold">{percent(analytics.kpis.checkoutCompletionRate)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Split-cart adoption</p>
              <p className="text-2xl font-bold">{percent(analytics.kpis.splitCartAdoptionRate)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Financing utilization</p>
              <p className="text-2xl font-bold">{percent(analytics.kpis.financingUtilizationRate)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Active days</p>
              <p className="text-2xl font-bold">{numberValue(analytics.kpis.dailyActiveDays)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Active carts</p>
              <p className="text-2xl font-bold">{numberValue(analytics.kpis.activeCartCount)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Cart items</p>
              <p className="text-2xl font-bold">{numberValue(analytics.kpis.cartItemCount)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Matched cart items</p>
              <p className="text-2xl font-bold">{numberValue(analytics.kpis.matchedCartItemCount)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Financing cards</p>
              <p className="text-2xl font-bold">{numberValue(analytics.kpis.financingEligibleCardCount)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Breakdown title="Actions" values={analytics.breakdowns.actions} />
            <Breakdown title="Imported retailers" values={analytics.breakdowns.importedRetailers} />
            <Breakdown title="Source retailers" values={analytics.breakdowns.sourceRetailers} />
          </div>

          <section className="mt-6 rounded-lg bg-white p-5 shadow">
            <h2 className="mb-3 font-semibold">Recent Activity</h2>
            {analytics.recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {analytics.recentActivity.map((event, index) => (
                  <div key={`${event.action}-${index}`} className="flex justify-between text-sm">
                    <span className="text-gray-700">{event.action}</span>
                    <span className="text-gray-500">{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
