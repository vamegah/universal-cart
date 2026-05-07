import {
  adminSelectMatch,
  adminRejectMatch,
  getAdminAnalytics,
  getAdminMatches,
  getAdminRetailers,
  getAdminSellerTrust,
  updateAdminRetailerConfig,
  updateAdminSellerTrust,
} from '@/services/api';
import { useEffect, useState } from 'react';

type RetailerHealth = {
  name: string;
  domains: string[];
  adapterConfigured: boolean;
  catalogListingCount: number;
  pricingRefreshCadence: string;
  catalogIngestionStatus: string;
  affiliateMode: string;
  affiliateId?: string | null;
  partnershipStatus: string;
  partnerContactEmail?: string | null;
  notes?: string | null;
  health: string;
};

type MatchReview = {
  id: string;
  cartItemId: string;
  retailerProductId: string;
  matchType: string;
  confidenceScore: number;
  isSelected: boolean;
  cartItem?: {
    product?: { name: string };
    cart?: { user?: { email: string } };
  };
  retailerProduct?: {
    retailerName: string;
    price: number;
    product?: { name: string };
  };
};

type AdminAnalytics = {
  generatedAt?: string;
  kpis: Record<string, number | null>;
};

type SellerTrustListing = {
  id: string;
  retailerName: string;
  sellerName?: string | null;
  isAuthorizedSeller: boolean;
  returnWindowDays?: number | null;
  warrantySupport: boolean;
  customerRating?: number | null;
  counterfeitRisk: string;
  product?: { name: string };
  trust: {
    score: number;
    label: string;
    signals: string[];
  };
};

function percent(value: number | null | undefined) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'N/A';
}

function numberValue(value: number | null | undefined) {
  return typeof value === 'number' ? value.toLocaleString() : 'N/A';
}

export default function AdminPage() {
  const [retailers, setRetailers] = useState<RetailerHealth[]>([]);
  const [matches, setMatches] = useState<MatchReview[]>([]);
  const [matchSummary, setMatchSummary] = useState<Record<string, number>>({});
  const [trustListings, setTrustListings] = useState<SellerTrustListing[]>([]);
  const [trustSummary, setTrustSummary] = useState<Record<string, number>>({});
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [savingRetailer, setSavingRetailer] = useState('');

  useEffect(() => {
    getAdminRetailers()
      .then((data) => {
        setRetailers(data.retailers || []);
        setGeneratedAt(data.generatedAt || '');
      })
      .catch((loadError: any) => {
        if (loadError.response?.status === 403) {
          setError('Admin access is required. Configure ADMIN_EMAILS on the API and sign in with an allowed account.');
        } else if (loadError.response?.status === 401) {
          setError('Sign in to view admin tools.');
        } else {
          setError('Unable to load retailer integration health.');
        }
      });
    getAdminMatches()
      .then((data) => {
        setMatches(data.matches || []);
        setMatchSummary(data.summary || {});
      })
      .catch(() => undefined);
    getAdminAnalytics()
      .then(setAnalytics)
      .catch(() => undefined);
    getAdminSellerTrust()
      .then((data) => {
        setTrustListings(data.listings || []);
        setTrustSummary(data.summary || {});
      })
      .catch(() => undefined);
  }, []);

  async function selectReviewedMatch(match: MatchReview) {
    setStatus('');
    await adminSelectMatch(match.cartItemId, {
      retailerProductId: match.retailerProductId,
      matchType: match.matchType,
      confidence: Math.max(match.confidenceScore, 0.95),
    });
    const data = await getAdminMatches();
    setMatches(data.matches || []);
    setMatchSummary(data.summary || {});
    setStatus('Match selection saved.');
  }

  async function rejectReviewedMatch(match: MatchReview, blacklistListing = false) {
    setStatus('');
    await adminRejectMatch(match.id, blacklistListing);
    const data = await getAdminMatches();
    setMatches(data.matches || []);
    setMatchSummary(data.summary || {});
    setStatus(blacklistListing ? 'Match rejected and listing blacklisted.' : 'Match rejected.');
  }

  async function updateTrust(listing: SellerTrustListing, risk: string, isAuthorizedSeller: boolean) {
    setStatus('');
    await updateAdminSellerTrust(listing.id, {
      isAuthorizedSeller,
      warrantySupport: isAuthorizedSeller,
      returnWindowDays: isAuthorizedSeller ? Math.max(listing.returnWindowDays || 0, 30) : listing.returnWindowDays,
      counterfeitRisk: risk,
    });
    const data = await getAdminSellerTrust();
    setTrustListings(data.listings || []);
    setTrustSummary(data.summary || {});
    setStatus('Seller trust signals saved.');
  }

  async function updateRetailerConfig(retailer: RetailerHealth, patch: Partial<RetailerHealth>) {
    setStatus('');
    setSavingRetailer(retailer.name);
    try {
      await updateAdminRetailerConfig(retailer.name, {
        pricingRefreshCadence: patch.pricingRefreshCadence ?? retailer.pricingRefreshCadence,
        catalogIngestionStatus: patch.catalogIngestionStatus ?? retailer.catalogIngestionStatus,
        affiliateMode: patch.affiliateMode ?? retailer.affiliateMode,
        affiliateId: patch.affiliateId ?? retailer.affiliateId ?? null,
        partnershipStatus: patch.partnershipStatus ?? retailer.partnershipStatus,
        partnerContactEmail: patch.partnerContactEmail ?? retailer.partnerContactEmail ?? null,
        notes: patch.notes ?? retailer.notes ?? null,
      });
      const data = await getAdminRetailers();
      setRetailers(data.retailers || []);
      setGeneratedAt(data.generatedAt || '');
      setStatus(`${retailer.name} integration configuration saved.`);
    } catch {
      setStatus(`Unable to save ${retailer.name} integration configuration.`);
    } finally {
      setSavingRetailer('');
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Admin</h1>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      {!error && (
        <>
          <div className="mb-4 rounded-lg bg-white p-4 shadow">
            <p className="text-sm text-gray-500">Retailer integration snapshot</p>
            <p className="font-semibold">{generatedAt ? new Date(generatedAt).toLocaleString() : 'Loading...'}</p>
          </div>
          <section className="mb-6 rounded-lg bg-white p-5 shadow">
            <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Global KPIs</h2>
                <p className="text-sm text-gray-500">
                  {analytics?.generatedAt ? new Date(analytics.generatedAt).toLocaleString() : 'Loading analytics...'}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Users</p>
                <p className="text-xl font-semibold">{numberValue(analytics?.kpis.totalUsers)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">DAU observations</p>
                <p className="text-xl font-semibold">{numberValue(analytics?.kpis.dailyActiveUsers)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Checkout completion</p>
                <p className="text-xl font-semibold">{percent(analytics?.kpis.checkoutCompletionRate)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Split-cart adoption</p>
                <p className="text-xl font-semibold">{percent(analytics?.kpis.splitCartAdoptionRate)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Financing utilization</p>
                <p className="text-xl font-semibold">{percent(analytics?.kpis.financingUtilizationRate)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Split plans</p>
                <p className="text-xl font-semibold">{numberValue(analytics?.kpis.splitPlanCount)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Imports</p>
                <p className="text-xl font-semibold">{numberValue(analytics?.kpis.cartImportCount)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Financing cards</p>
                <p className="text-xl font-semibold">{numberValue(analytics?.kpis.financingEligibleCardCount)}</p>
              </div>
            </div>
          </section>
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3">Retailer</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Listings</th>
                  <th className="px-4 py-3">Refresh</th>
                  <th className="px-4 py-3">Ingestion</th>
                  <th className="px-4 py-3">Affiliate</th>
                  <th className="px-4 py-3">Partnership</th>
                  <th className="px-4 py-3">Domains</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {retailers.map((retailer) => (
                  <tr key={retailer.name}>
                    <td className="px-4 py-3 font-medium">{retailer.name}</td>
                    <td className="px-4 py-3">
                      <span className={retailer.adapterConfigured ? 'rounded bg-green-50 px-2 py-1 text-green-700' : 'rounded bg-red-50 px-2 py-1 text-red-700'}>
                        {retailer.health}
                      </span>
                    </td>
                    <td className="px-4 py-3">{retailer.catalogListingCount}</td>
                    <td className="px-4 py-3">
                      <select
                        value={retailer.pricingRefreshCadence}
                        disabled={savingRetailer === retailer.name}
                        onChange={(event) => updateRetailerConfig(retailer, { pricingRefreshCadence: event.target.value })}
                        className="w-full rounded border px-2 py-1"
                      >
                        <option value="manual_or_import_triggered">Manual/import</option>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="paused">Paused</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={retailer.catalogIngestionStatus}
                        disabled={savingRetailer === retailer.name}
                        onChange={(event) => updateRetailerConfig(retailer, { catalogIngestionStatus: event.target.value })}
                        className="w-full rounded border px-2 py-1"
                      >
                        <option value="manual">Manual</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="paused">Paused</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={retailer.affiliateMode}
                        disabled={savingRetailer === retailer.name}
                        onChange={(event) => updateRetailerConfig(retailer, { affiliateMode: event.target.value })}
                        className="w-full rounded border px-2 py-1"
                      >
                        <option value="not_configured">Not configured</option>
                        <option value="manual_links">Manual links</option>
                        <option value="network_feed">Network feed</option>
                        <option value="partner_api">Partner API</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={retailer.partnershipStatus}
                        disabled={savingRetailer === retailer.name}
                        onChange={(event) => updateRetailerConfig(retailer, { partnershipStatus: event.target.value })}
                        className="w-full rounded border px-2 py-1"
                      >
                        <option value="unverified">Unverified</option>
                        <option value="outreach">Outreach</option>
                        <option value="contracting">Contracting</option>
                        <option value="partnered">Partnered</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{retailer.domains.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="mt-6 rounded-lg bg-white p-5 shadow">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Seller Trust Review</h2>
                <p className="text-sm text-gray-500">
                  {trustSummary.total || 0} queued, {trustSummary.needsReview || 0} need review, {trustSummary.highRisk || 0} high risk
                </p>
              </div>
              {status && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{status}</p>}
            </div>
            {trustListings.length === 0 ? (
              <p className="text-sm text-gray-500">No seller trust listings need review.</p>
            ) : (
              <div className="space-y-3">
                {trustListings.slice(0, 10).map((listing) => (
                  <div key={listing.id} className="rounded border p-3 text-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{listing.product?.name || 'Unknown product'}</p>
                        <p className="text-gray-500">
                          {listing.retailerName} seller {listing.sellerName || 'unknown'}: {listing.trust.score}/100 {listing.trust.label}
                        </p>
                        <p className="text-gray-500">
                          Risk {listing.counterfeitRisk}, {listing.isAuthorizedSeller ? 'authorized' : 'unverified'}, {listing.returnWindowDays || 0}-day returns
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateTrust(listing, 'low', true)}
                          className="rounded bg-green-600 px-3 py-2 text-white"
                        >
                          Verify seller
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTrust(listing, 'high', false)}
                          className="rounded bg-red-600 px-3 py-2 text-white"
                        >
                          Flag high risk
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 rounded-lg bg-white p-5 shadow">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Match Review Queue</h2>
                <p className="text-sm text-gray-500">
                  {matchSummary.total || 0} queued, {matchSummary.lowConfidence || 0} low-confidence, {matchSummary.substitutes || 0} substitutes, {matchSummary.rejected || 0} rejected
                </p>
              </div>
            </div>
            {matches.length === 0 ? (
              <p className="text-sm text-gray-500">No low-confidence matches queued.</p>
            ) : (
              <div className="space-y-3">
                {matches.slice(0, 10).map((match) => (
                  <div key={match.id} className="rounded border p-3 text-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{match.cartItem?.product?.name || 'Unknown source product'}</p>
                        <p className="text-gray-500">
                          Candidate: {match.retailerProduct?.product?.name || 'Unknown'} at {match.retailerProduct?.retailerName}
                        </p>
                        <p className="text-gray-500">
                          {match.matchType}, {(match.confidenceScore * 100).toFixed(1)}% confidence, user {match.cartItem?.cart?.user?.email || 'unknown'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => selectReviewedMatch(match)}
                          className="rounded bg-blue-600 px-3 py-2 text-white"
                        >
                          Select match
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectReviewedMatch(match)}
                          className="rounded border border-red-300 px-3 py-2 text-red-700"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectReviewedMatch(match, true)}
                          className="rounded bg-red-600 px-3 py-2 text-white"
                        >
                          Blacklist listing
                        </button>
                      </div>
                    </div>
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
