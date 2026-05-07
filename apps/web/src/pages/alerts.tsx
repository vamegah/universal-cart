import { createAlert, deleteAlert, getAlerts, updateAlert } from '@/services/api';
import { useCart } from '@/hooks/useCart';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AlertSubscription = {
  id: string;
  alertType: string;
  targetPrice?: number | null;
  status: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    imageUrl?: string;
    retailerProducts?: Array<{ retailerName: string; price: number; inStock: boolean }>;
  };
};

const ALERT_TYPES = [
  { value: 'price_drop', label: 'Price drop' },
  { value: 'restock', label: 'Restock' },
  { value: 'transfer_opportunity', label: 'Transfer opportunity' },
  { value: 'promo_expiration', label: 'Promo expiration' },
  { value: 'card_offer', label: 'Card offer' },
];

export default function AlertsPage() {
  const { items, hydrateCart } = useCart();
  const [alerts, setAlerts] = useState<AlertSubscription[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [alertType, setAlertType] = useState('price_drop');
  const [targetPrice, setTargetPrice] = useState('');
  const [status, setStatus] = useState('');
  const [targetEdits, setTargetEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const cartProducts = useMemo(() => {
    const products = new Map<string, { id: string; name: string; price: number }>();
    for (const item of items) {
      if (item.productId && !products.has(item.productId)) {
        products.set(item.productId, { id: item.productId, name: item.productName, price: item.price });
      }
    }
    return Array.from(products.values());
  }, [items]);

  const loadAlerts = useCallback(async () => {
    const data = await getAlerts();
    setAlerts(data || []);
  }, []);

  useEffect(() => {
    hydrateCart().catch(() => undefined);
    loadAlerts().catch((loadError: any) => {
      setError(loadError.response?.status === 401 ? 'Sign in to manage alerts.' : 'Unable to load alerts.');
    });
  }, [hydrateCart, loadAlerts]);

  useEffect(() => {
    if (!selectedProductId && cartProducts[0]) {
      setSelectedProductId(cartProducts[0].id);
    }
  }, [cartProducts, selectedProductId]);

  async function subscribe() {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await createAlert({
        productId: selectedProductId,
        alertType,
        targetPrice: targetPrice ? Number(targetPrice) : null,
      });
      setTargetPrice('');
      await loadAlerts();
      setStatus('Alert subscription saved.');
    } catch (subscribeError: any) {
      setError(subscribeError.response?.data?.error || 'Unable to create alert.');
    } finally {
      setIsBusy(false);
    }
  }

  async function setAlertStatus(alertId: string, nextStatus: string) {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await updateAlert(alertId, { status: nextStatus });
      await loadAlerts();
      setStatus(nextStatus === 'paused' ? 'Alert paused.' : 'Alert activated.');
    } catch (updateError: any) {
      setError(updateError.response?.data?.error || 'Unable to update alert.');
    } finally {
      setIsBusy(false);
    }
  }

  async function saveAlertTarget(alertId: string) {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      const nextValue = targetEdits[alertId];
      await updateAlert(alertId, { targetPrice: nextValue ? Number(nextValue) : null });
      await loadAlerts();
      setTargetEdits((current) => {
        const next = { ...current };
        delete next[alertId];
        return next;
      });
      setStatus('Alert target updated.');
    } catch (updateError: any) {
      setError(updateError.response?.data?.error || 'Unable to update alert target.');
    } finally {
      setIsBusy(false);
    }
  }

  async function removeAlert(alertId: string) {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await deleteAlert(alertId);
      await loadAlerts();
      setStatus('Alert deleted.');
    } catch (deleteError: any) {
      setError(deleteError.response?.data?.error || 'Unable to delete alert.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Alerts</h1>

      <section className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-xl font-semibold">Create Alert</h2>
        {cartProducts.length === 0 ? (
          <p className="text-sm text-gray-500">
            Add products to your <Link href="/cart" className="text-blue-600">cart</Link> before creating alerts.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="rounded border px-3 py-2 md:col-span-2"
            >
              {cartProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <select
              value={alertType}
              onChange={(event) => setAlertType(event.target.value)}
              className="rounded border px-3 py-2"
            >
              {ALERT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetPrice}
              onChange={(event) => setTargetPrice(event.target.value)}
              placeholder="Target price"
              className="rounded border px-3 py-2"
            />
            <button
              type="button"
              onClick={subscribe}
              disabled={isBusy || !selectedProductId}
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Save alert
            </button>
          </div>
        )}
      </section>

      {status && <div className="mb-4 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">{status}</div>}
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

      <div className="space-y-4">
        {alerts.length === 0 ? (
          <p className="text-gray-500">No alert subscriptions yet.</p>
        ) : (
          alerts.map((alert) => {
            const lowestListing = alert.product?.retailerProducts?.reduce((best, listing) => {
              if (!best || listing.price < best.price) return listing;
              return best;
            }, undefined as undefined | { retailerName: string; price: number; inStock: boolean });

            return (
              <article key={alert.id} className="rounded-lg bg-white p-5 shadow">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="font-semibold">{alert.product?.name || 'Unknown product'}</h2>
                    <p className="text-sm text-gray-500">
                      {ALERT_TYPES.find((type) => type.value === alert.alertType)?.label || alert.alertType} - {alert.status}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {alert.targetPrice != null ? `Target: $${alert.targetPrice.toFixed(2)}` : 'No target price set'}
                      {lowestListing ? ` - Lowest known: $${lowestListing.price.toFixed(2)} at ${lowestListing.retailerName}` : ''}
                    </p>
                    <div className="mt-3 flex max-w-sm flex-col gap-2 sm:flex-row">
                      <label htmlFor={`target-${alert.id}`} className="sr-only">
                        Alert target price
                      </label>
                      <input
                        id={`target-${alert.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={targetEdits[alert.id] ?? (alert.targetPrice != null ? String(alert.targetPrice) : '')}
                        onChange={(event) =>
                          setTargetEdits((current) => ({ ...current, [alert.id]: event.target.value }))
                        }
                        className="rounded border px-3 py-2 text-sm"
                        placeholder="Target price"
                      />
                      <button
                        type="button"
                        onClick={() => saveAlertTarget(alert.id)}
                        disabled={isBusy}
                        className="rounded border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                      >
                        Save target
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAlertStatus(alert.id, alert.status === 'paused' ? 'active' : 'paused')}
                      disabled={isBusy}
                      className="rounded border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                    >
                      {alert.status === 'paused' ? 'Activate' : 'Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAlert(alert.id)}
                      disabled={isBusy}
                      className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
