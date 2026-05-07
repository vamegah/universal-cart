import { useCart } from '@/hooks/useCart';
import {
  getCartRedirect,
  getCheckoutFinancingOptions,
  getCheckoutStoreStatuses,
  validateCheckoutReadiness,
} from '@/services/api';
import { usePreferences } from '@/hooks/usePreferences';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const DEFAULT_CHECKOUT_STORE_NAMES = ['Amazon', 'Walmart', 'Target', "Macy's"];

interface StoreOption {
  name: string;
  supported: boolean;
  reason: string;
  routeType?: string;
  message?: string;
  limitations?: string[];
}

interface FinancingOption {
  cardId: string;
  retailerName: string;
  cardLast4: string;
  providerType: string;
  apr: number;
  minPurchase: number;
  creditLimit: number;
  termMonths?: number;
  promoEndsAt?: string;
  monthlyFee?: number;
  downPayment?: number;
  cashPrice: number;
  rewardsValue: number;
  rewardsAdjustedTotal: number;
  totalRepayment: number;
  financingCost: number;
  estimatedMonthlyPayment?: number;
  budgetWarnings: string[];
}

const CHECKOUT_STORE_HOSTNAMES: Record<string, string[]> = {
  Amazon: ['amazon.com', 'www.amazon.com'],
  Walmart: ['walmart.com', 'www.walmart.com'],
  Target: ['target.com', 'www.target.com'],
  "Macy's": ['macys.com', 'www.macys.com'],
};

function normalizeHostname(href: string): string | null {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isStoreUrlForRetailer(store: string, url?: string) {
  if (!url) return false;
  const hostname = normalizeHostname(url);
  if (!hostname) return false;
  return CHECKOUT_STORE_HOSTNAMES[store]?.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function getDefaultStoreOptions(items: any[]) {
  return DEFAULT_CHECKOUT_STORE_NAMES.map((store) => ({
    name: store,
    supported: false,
    reason: 'Checking store compatibility...',
    routeType: 'unsupported',
    message: 'Checking store compatibility...',
  }));
}

function getFallbackStoreOptions(items: any[]) {
  return DEFAULT_CHECKOUT_STORE_NAMES.map((store) => ({
    name: store,
    supported: isStoreSupportedForCart(store, items),
    reason: getStoreSupportReason(store, items),
    routeType: isStoreSupportedForCart(store, items) ? (store.toLowerCase() === 'amazon' ? 'cart_add' : 'product_page') : 'unsupported',
    message: getStoreSupportReason(store, items),
  }));
}

function routeTypeLabel(routeType?: string) {
  if (routeType === 'cart_add') return 'Cart prebuild';
  if (routeType === 'product_page') return 'Product-page redirect';
  if (routeType === 'single_item_cart_add') return 'Single-item cart route';
  return 'Unsupported';
}

function isStoreSupportedForCart(store: string, items: any[]) {
  if (store.toLowerCase() === 'amazon') {
    return items.every((item) => Boolean(item.retailerSku || item.matchedProductId || item.productId || item.sku) && Number(item.quantity || 1) > 0);
  }

  if (items.length !== 1) {
    return false;
  }

  const item = items[0];
  return Boolean(
    item.retailerSku ||
      item.matchedProductId ||
      item.productId ||
      item.sku ||
      isStoreUrlForRetailer(store, item.matchedUrl) ||
      isStoreUrlForRetailer(store, item.sourceUrl)
  );
}

function getStoreSupportReason(store: string, items: any[]) {
  if (isStoreSupportedForCart(store, items)) {
    return '';
  }

  if (store.toLowerCase() === 'amazon') {
    return 'Amazon checkout requires a retailer SKU or product identifier and quantity for every cart item.';
  }

  if (items.length !== 1) {
    return 'Non-Amazon checkout currently supports only one cart item at a time.';
  }

  const item = items[0];
  if (item.retailerSku || item.matchedProductId || item.productId || item.sku) {
    return '';
  }

  if (item.matchedUrl || item.sourceUrl) {
    return `No verified ${store} product page URL is available for this item.`;
  }

  return `No product identifier or listing URL is available for ${store}.`;
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatProvider(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CheckoutPage() {
  const { items } = useCart();
  const {
    defaultCheckoutStore,
    defaultShippingMethod,
    maxOrderBudget,
    monthlyFinancingCap,
    preferredInstallmentAmount,
    setDefaultCheckoutStore,
    setDefaultShippingMethod,
  } = usePreferences();
  const [checkoutStore, setCheckoutStore] = useState(defaultCheckoutStore || '');
  const [shippingMethod, setShippingMethod] = useState(defaultShippingMethod || 'standard');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutWarnings, setCheckoutWarnings] = useState<string[]>([]);
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>(getDefaultStoreOptions(items));
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [autoSelectMessage, setAutoSelectMessage] = useState<string | null>(null);
  const [approvedSubstitutes, setApprovedSubstitutes] = useState<Record<string, boolean>>({});
  const [financingOptions, setFinancingOptions] = useState<FinancingOption[]>([]);
  const [isLoadingFinancing, setIsLoadingFinancing] = useState(false);
  const [financingError, setFinancingError] = useState<string | null>(null);

  const selectedStoreOption = storeOptions.find((option) => option.name === checkoutStore);
  const supportedStoreOptions = storeOptions.filter((option) => option.supported);
  const selectedStoreSupported = selectedStoreOption?.supported ?? false;
  const hasAnySupportedStore = storeOptions.some((option) => option.supported);
  const approvalRequiredItems = items.filter(
    (item) => item.matchedProductId && item.matchType && item.matchType !== 'exact'
  );
  const checkoutItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        substituteApproved: approvedSubstitutes[item.id] === true,
      })),
    [items, approvedSubstitutes]
  );
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  useEffect(() => {
    if (!checkoutStore || !selectedStoreSupported) {
      const firstValidStore = storeOptions.find((option) => option.supported);
      if (firstValidStore) {
        setCheckoutStore(firstValidStore.name);
        setDefaultCheckoutStore(firstValidStore.name);
        setAutoSelectMessage(
          `Checkout store changed to ${firstValidStore.name} because the previous choice is not compatible with the current cart.`
        );
      }
    } else {
      setAutoSelectMessage(null);
    }
  }, [checkoutStore, selectedStoreSupported, storeOptions, setDefaultCheckoutStore]);

  useEffect(() => {
    async function loadStores() {
      setIsLoadingStores(true);
      try {
        const statuses = await getCheckoutStoreStatuses(checkoutItems);
        setStoreOptions(statuses);
      } catch (error) {
        console.error('Failed to load supported checkout stores', error);
        setStoreOptions(getFallbackStoreOptions(checkoutItems));
      } finally {
        setIsLoadingStores(false);
      }
    }

    loadStores();
  }, [checkoutItems]);

  useEffect(() => {
    if (total <= 0) {
      setFinancingOptions([]);
      return;
    }

    async function loadFinancingOptions() {
      setIsLoadingFinancing(true);
      setFinancingError(null);
      try {
        const options = await getCheckoutFinancingOptions(total);
        setFinancingOptions(options);
      } catch (error: any) {
        setFinancingOptions([]);
        setFinancingError(error.response?.data?.error || 'Financing options are unavailable right now.');
      } finally {
        setIsLoadingFinancing(false);
      }
    }

    loadFinancingOptions();
  }, [total]);

  const handleCheckout = async () => {
    if (!checkoutStore) return;
    setDefaultCheckoutStore(checkoutStore);
    setDefaultShippingMethod(shippingMethod);
    setIsRedirecting(true);
    setCheckoutError(null);
    setCheckoutWarnings([]);

    try {
      const validation = await validateCheckoutReadiness(checkoutItems, checkoutStore);
      if (!validation.ready) {
        setCheckoutError(validation.errors.map((error: any) => error.message).join(' '));
        setCheckoutWarnings(validation.warnings.map((warning: any) => warning.message));
        return;
      }

      if (validation.warnings.length > 0) {
        setCheckoutError('Checkout has warnings. Review the item details before proceeding.');
        setCheckoutWarnings(validation.warnings.map((warning: any) => warning.message));
        return;
      }

      const redirect = await getCartRedirect(checkoutItems, checkoutStore);
      if (redirect.message) setCheckoutWarnings([redirect.message]);
      window.location.href = redirect.redirectUrl;
    } catch (err: any) {
      setCheckoutError(err.response?.data?.error || 'Checkout failed. Please try again.');
      console.error(err);
    } finally {
      setIsRedirecting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center">
        <p>No items to checkout.</p>
        <Link href="/" className="text-blue-600">Add items</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Checkout</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
        {items.map((item) => (
          <div key={item.id} className="flex justify-between py-2 border-b">
            <span>
              {item.productName} x{item.quantity}
              {item.matchedStore && <span className="text-sm text-green-600 ml-2">-&gt; {item.matchedStore}</span>}
            </span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold mt-4 pt-2 border-t">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
        {(maxOrderBudget || monthlyFinancingCap || preferredInstallmentAmount) && (
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {maxOrderBudget && <p>Max order budget: ${Number(maxOrderBudget).toFixed(2)}</p>}
            {monthlyFinancingCap && <p>Monthly financing cap: ${Number(monthlyFinancingCap).toFixed(2)}</p>}
            {preferredInstallmentAmount && <p>Preferred installment: ${Number(preferredInstallmentAmount).toFixed(2)}</p>}
          </div>
        )}

        <div className="mt-6 border-t pt-5">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Financing comparison</h2>
              <p className="text-sm text-gray-500">Ranked by rewards-adjusted repayment for this cart.</p>
            </div>
            <p className="text-sm font-medium text-gray-700">Cash price {formatMoney(total)}</p>
          </div>
          {isLoadingFinancing && <p className="text-sm text-gray-500">Loading financing options...</p>}
          {!isLoadingFinancing && financingError && <p className="text-sm text-red-600">{financingError}</p>}
          {!isLoadingFinancing && !financingError && financingOptions.length === 0 && (
            <p className="text-sm text-gray-500">No saved card or BNPL terms are eligible for this total.</p>
          )}
          {!isLoadingFinancing && financingOptions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Option</th>
                    <th className="py-2 pr-3 font-medium">Installment</th>
                    <th className="py-2 pr-3 font-medium">APR</th>
                    <th className="py-2 pr-3 font-medium">Cash</th>
                    <th className="py-2 pr-3 font-medium">Repayment</th>
                    <th className="py-2 pr-3 font-medium">Rewards adjusted</th>
                    <th className="py-2 pr-3 font-medium">Financing cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {financingOptions.slice(0, 5).map((option) => (
                    <tr key={option.cardId} className="align-top">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-gray-900">{option.retailerName} ending {option.cardLast4}</p>
                        <p className="text-xs text-gray-500">{formatProvider(option.providerType)}</p>
                        {option.budgetWarnings.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-xs text-yellow-700">
                            {option.budgetWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {option.estimatedMonthlyPayment != null && option.termMonths
                          ? `${formatMoney(option.estimatedMonthlyPayment)} x ${option.termMonths}`
                          : 'Pay in full'}
                        {option.downPayment != null && (
                          <p className="text-xs text-gray-500">Down {formatMoney(option.downPayment)}</p>
                        )}
                        {option.monthlyFee != null && (
                          <p className="text-xs text-gray-500">Fee {formatMoney(option.monthlyFee)}/mo</p>
                        )}
                      </td>
                      <td className="py-3 pr-3">{option.apr.toFixed(2)}%</td>
                      <td className="py-3 pr-3">{formatMoney(option.cashPrice)}</td>
                      <td className="py-3 pr-3">{formatMoney(option.totalRepayment)}</td>
                      <td className="py-3 pr-3">
                        {formatMoney(option.rewardsAdjustedTotal)}
                        {option.rewardsValue > 0 && (
                          <p className="text-xs text-green-700">Includes {formatMoney(option.rewardsValue)} rewards</p>
                        )}
                      </td>
                      <td className="py-3 pr-3">{formatMoney(option.financingCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium mb-1">Pay with store card</label>
          <select
            value={checkoutStore}
            onChange={(e) => {
              setCheckoutStore(e.target.value);
              setDefaultCheckoutStore(e.target.value);
            }}
            className="w-full border rounded-lg px-4 py-2 mb-4"
          >
            <option value="">Select a store where you have a card</option>
            {storeOptions.map((option) => (
              <option key={option.name} value={option.name} disabled={!option.supported}>
                {option.name} Card{!option.supported ? ' (unsupported)' : ''}
              </option>
            ))}
          </select>

          {approvalRequiredItems.length > 0 && (
            <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
              <p className="mb-2 text-sm font-semibold text-yellow-900">Approve non-exact matches</p>
              <div className="space-y-2">
                {approvalRequiredItems.map((item) => (
                  <label key={item.id} className="flex gap-2 text-sm text-yellow-950">
                    <input
                      type="checkbox"
                      checked={approvedSubstitutes[item.id] === true}
                      onChange={(event) =>
                        setApprovedSubstitutes((current) => ({
                          ...current,
                          [item.id]: event.target.checked,
                        }))
                      }
                      className="mt-1"
                    />
                    <span>
                      Approve {item.matchType} match for {item.productName}
                      {item.matchedStore ? ` at ${item.matchedStore}` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {isLoadingStores && (
            <p className="text-xs text-gray-500 mb-4">Loading supported checkout stores...</p>
          )}
          {!isLoadingStores && supportedStoreOptions.length === 0 && (
            <p className="text-xs text-red-600 mb-4">No supported stores are available for checkout right now.</p>
          )}
          {!isLoadingStores && !hasAnySupportedStore && (
            <p className="text-sm text-red-600 mb-4">No available checkout stores are compatible with the current cart items.</p>
          )}
          {autoSelectMessage && (
            <p className="text-sm text-blue-600 mb-4">{autoSelectMessage}</p>
          )}
          {checkoutStore && !selectedStoreSupported && selectedStoreOption?.reason && (
            <p className="text-sm text-red-600 mb-4">{selectedStoreOption.reason}</p>
          )}
          {checkoutStore && selectedStoreOption && (
            <div className="mb-4 rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-medium">{routeTypeLabel(selectedStoreOption.routeType)}</p>
              {selectedStoreOption.message && <p className="mt-1">{selectedStoreOption.message}</p>}
              {selectedStoreOption.limitations && selectedStoreOption.limitations.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-gray-600">
                  {selectedStoreOption.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <label className="block text-sm font-medium mb-1">Preferred shipping method</label>
          <select
            value={shippingMethod}
            onChange={(e) => {
              const method = e.target.value as 'standard' | 'expedited' | 'two-day';
              setShippingMethod(method);
              setDefaultShippingMethod(method);
            }}
            className="w-full border rounded-lg px-4 py-2 mb-4"
          >
            <option value="standard">Standard Shipping</option>
            <option value="expedited">Expedited Shipping</option>
            <option value="two-day">Two-Day Shipping</option>
          </select>

          <button
            onClick={handleCheckout}
            disabled={!checkoutStore || isRedirecting || !selectedStoreSupported || !hasAnySupportedStore}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isRedirecting ? 'Redirecting to store...' : `Checkout with ${checkoutStore || 'Store'}`}
          </button>
          {checkoutError && <p className="text-sm text-red-600 mt-2 text-center">{checkoutError}</p>}
          {checkoutWarnings.length > 0 && (
            <div className="text-left bg-yellow-100 border border-yellow-300 rounded-lg p-3 mt-3">
              <p className="text-sm font-semibold text-yellow-800">Checkout warnings</p>
              <ul className="list-disc list-inside text-sm text-yellow-900">
                {checkoutWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2 text-center">
            You will be redirected to the store&apos;s cart to complete payment.
          </p>
        </div>
      </div>
    </div>
  );
}
