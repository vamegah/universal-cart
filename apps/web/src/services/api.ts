import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 10000,
});

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('universal-cart-auth-token');
}

function storeAuthToken(token: string) {
  window.localStorage.setItem('universal-cart-auth-token', token);
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('universal-cart-auth-token');
  }
}

async function authHeaders() {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signup(email: string, password: string) {
  const response = await apiClient.post('/auth/signup', { email, password });
  storeAuthToken(response.data.token);
  return response.data;
}

export async function login(email: string, password: string) {
  const response = await apiClient.post('/auth/login', { email, password });
  storeAuthToken(response.data.token);
  return response.data;
}

export async function refreshSession() {
  const response = await apiClient.post('/auth/refresh', {}, { headers: await authHeaders() });
  if (response.data.token) storeAuthToken(response.data.token);
  return response.data;
}

export async function logout() {
  try {
    await apiClient.post('/auth/logout', {}, { headers: await authHeaders() });
  } catch {
    // Local logout should still succeed if the token has expired or the API is offline.
  } finally {
    clearAuthToken();
  }
}

export async function getMe() {
  const response = await apiClient.get('/auth/me', { headers: await authHeaders() });
  return response.data.user;
}

export async function getProfile() {
  const response = await apiClient.get('/profile', { headers: await authHeaders() });
  return response.data;
}

export async function saveProfilePreferences(preferences: {
  defaultStore?: string;
  defaultCardId?: string | null;
  shippingPref?: Record<string, unknown> | null;
}) {
  const response = await apiClient.put('/profile/preferences', preferences, { headers: await authHeaders() });
  return response.data.preferences;
}

export async function addProfileCard(card: {
  retailerName: string;
  cardToken: string;
  cardLast4: string;
  rewardsRate: number;
  consentAccepted: boolean;
  financingTerms?: Record<string, unknown> | null;
}) {
  const response = await apiClient.post('/profile/cards', card, { headers: await authHeaders() });
  return response.data.card;
}

export async function deleteProfileCard(cardId: string) {
  await apiClient.delete(`/profile/cards/${cardId}`, { headers: await authHeaders() });
}

export async function getAuditEvents(limit = 50) {
  const response = await apiClient.get('/audit', {
    params: { limit },
    headers: await authHeaders(),
  });
  return response.data.events;
}

export async function exportPrivacyData() {
  const response = await apiClient.get('/privacy/export', { headers: await authHeaders() });
  return response.data;
}

export async function deleteAccountData(confirmation: string) {
  const response = await apiClient.delete('/privacy/account', {
    headers: await authHeaders(),
    data: { confirmation },
  });
  return response.data;
}

export async function getServerCart() {
  const response = await apiClient.get('/cart', { headers: await authHeaders() });
  return response.data;
}

export async function removeServerCartItem(itemId: string) {
  await apiClient.delete(`/cart/items/${itemId}`, { headers: await authHeaders() });
}

export async function updateServerCartItemQuantity(itemId: string, quantity: number) {
  const response = await apiClient.put(`/cart/items/${itemId}/quantity`, { quantity }, { headers: await authHeaders() });
  return response.data;
}

export async function addServerCartItem(productId: string, sourceRetailer: string, quantity = 1) {
  const response = await apiClient.post(
    '/cart/items',
    { productId, sourceRetailer, quantity },
    { headers: await authHeaders() }
  );
  return response.data;
}

export async function clearServerCart() {
  const response = await apiClient.delete('/cart', { headers: await authHeaders() });
  return response.data;
}

export async function getSavedLists() {
  const response = await apiClient.get('/lists', { headers: await authHeaders() });
  return response.data.lists;
}

export async function createSavedList(name: string) {
  const response = await apiClient.post('/lists', { name }, { headers: await authHeaders() });
  return response.data.list;
}

export async function saveActiveCartAsList(name: string) {
  const response = await apiClient.post('/lists/from-cart', { name }, { headers: await authHeaders() });
  return response.data.list;
}

export async function renameSavedList(listId: string, name: string) {
  const response = await apiClient.put(`/lists/${listId}`, { name }, { headers: await authHeaders() });
  return response.data.list;
}

export async function shareSavedList(listId: string, email: string, role = 'viewer') {
  const response = await apiClient.post(`/lists/${listId}/share`, { email, role }, { headers: await authHeaders() });
  return response.data.share;
}

export async function removeSavedListShare(listId: string, shareId: string) {
  await apiClient.delete(`/lists/${listId}/share/${shareId}`, { headers: await authHeaders() });
}

export async function restoreSavedList(listId: string) {
  const response = await apiClient.post(`/lists/${listId}/restore`, {}, { headers: await authHeaders() });
  return response.data.cart;
}

export async function deleteSavedList(listId: string) {
  await apiClient.delete(`/lists/${listId}`, { headers: await authHeaders() });
}

export async function addSavedListItem(
  listId: string,
  item: { productId: string; sourceRetailer: string; quantity?: number }
) {
  const response = await apiClient.post(`/lists/${listId}/items`, item, { headers: await authHeaders() });
  return response.data.item;
}

export async function updateSavedListItem(listId: string, itemId: string, data: { quantity?: number; approved?: boolean }) {
  const response = await apiClient.patch(
    `/lists/${listId}/items/${itemId}`,
    data,
    { headers: await authHeaders() }
  );
  return response.data.item;
}

export async function removeSavedListItem(listId: string, itemId: string) {
  await apiClient.delete(`/lists/${listId}/items/${itemId}`, { headers: await authHeaders() });
}

export async function getAlerts() {
  const response = await apiClient.get('/alerts', { headers: await authHeaders() });
  return response.data.alerts;
}

export async function createAlert(alert: {
  productId: string;
  alertType: string;
  targetPrice?: number | null;
}) {
  const response = await apiClient.post('/alerts', alert, { headers: await authHeaders() });
  return response.data.alert;
}

export async function updateAlert(
  alertId: string,
  data: { status?: string; targetPrice?: number | null }
) {
  const response = await apiClient.patch(`/alerts/${alertId}`, data, { headers: await authHeaders() });
  return response.data.alert;
}

export async function deleteAlert(alertId: string) {
  await apiClient.delete(`/alerts/${alertId}`, { headers: await authHeaders() });
}

export async function getAnalytics() {
  const response = await apiClient.get('/analytics', { headers: await authHeaders() });
  return response.data;
}

export async function optimizeShipping(items: Array<Record<string, unknown>>) {
  const response = await apiClient.post('/shipping/optimize', { items }, { headers: await authHeaders() });
  return response.data;
}

export async function estimateShippingRates(requests: Array<Record<string, unknown>>) {
  const response = await apiClient.post('/shipping/rates', { requests }, { headers: await authHeaders() });
  return response.data.rates;
}

export async function selectShippingPlan(plan: { planName: string; planData: unknown; totalCost: number; cartId?: string }) {
  const response = await apiClient.post('/shipping/select', plan, { headers: await authHeaders() });
  return response.data.plan;
}

export async function getSelectedShippingPlan(cartId?: string) {
  const response = await apiClient.get('/shipping/selected', {
    params: cartId ? { cartId } : {},
    headers: await authHeaders(),
  });
  return response.data.plan;
}

export async function getAdminRetailers() {
  const response = await apiClient.get('/admin/retailers', { headers: await authHeaders() });
  return response.data;
}

export async function updateAdminRetailerConfig(
  retailerName: string,
  data: {
    pricingRefreshCadence?: string;
    catalogIngestionStatus?: string;
    affiliateMode?: string;
    affiliateId?: string | null;
    partnershipStatus?: string;
    partnerContactEmail?: string | null;
    notes?: string | null;
  }
) {
  const response = await apiClient.patch(`/admin/retailers/${encodeURIComponent(retailerName)}`, data, {
    headers: await authHeaders(),
  });
  return response.data.config;
}

export async function getAdminMatches(limit = 50) {
  const response = await apiClient.get('/admin/matches', {
    params: { limit },
    headers: await authHeaders(),
  });
  return response.data;
}

export async function getAdminAnalytics() {
  const response = await apiClient.get('/admin/analytics', { headers: await authHeaders() });
  return response.data;
}

export async function getAdminSellerTrust(limit = 50) {
  const response = await apiClient.get('/admin/seller-trust', {
    params: { limit },
    headers: await authHeaders(),
  });
  return response.data;
}

export async function updateAdminSellerTrust(
  retailerProductId: string,
  data: {
    sellerName?: string;
    isAuthorizedSeller?: boolean;
    returnWindowDays?: number | null;
    warrantySupport?: boolean;
    customerRating?: number | null;
    counterfeitRisk?: string;
  }
) {
  const response = await apiClient.patch(`/admin/seller-trust/${retailerProductId}`, data, { headers: await authHeaders() });
  return response.data.listing;
}

export async function adminSelectMatch(
  cartItemId: string,
  data: { retailerProductId: string; matchType?: string; confidence?: number }
) {
  const response = await apiClient.post(`/admin/matches/${cartItemId}/select`, data, { headers: await authHeaders() });
  return response.data.match;
}

export async function adminRejectMatch(matchId: string, blacklistListing = false) {
  const response = await apiClient.post(
    `/admin/matches/${matchId}/reject`,
    { blacklistListing },
    { headers: await authHeaders() }
  );
  return response.data;
}

export async function parseCartRules(text: string) {
  const response = await apiClient.post('/rules/parse', { text }, { headers: await authHeaders() });
  return response.data.rules;
}

export async function importProductFromUrl(url: string): Promise<any> {
  const response = await apiClient.post('/import/url', { url }, { headers: await authHeaders() });
  return response.data;
}

export async function searchProducts(query: string, retailer?: string): Promise<any> {
  const response = await apiClient.post(
    '/import/search',
    { query, retailer: retailer || undefined },
    { headers: await authHeaders() }
  );
  return response.data;
}

export async function optimizeCartSplit(request: {
  items: Array<Record<string, unknown>>;
  userStores: string[];
  shippingThresholds?: Array<Record<string, unknown>>;
}) {
  const response = await apiClient.post('/optimize', request, { headers: await authHeaders() });
  return response.data;
}

export async function recommendShoppingCopilot(request: {
  command: string;
  items: Array<Record<string, unknown>>;
  userStores?: string[];
}) {
  const response = await apiClient.post('/copilot/recommend', request, { headers: await authHeaders() });
  return response.data;
}

export async function matchProduct(product: any, preferredStore: string): Promise<any> {
  try {
    const response = await apiClient.post('/match', { product, preferredStore }, { headers: await authHeaders() });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return {
        matchType: 'none',
        confidence: 0,
        retailerProduct: null,
      };
    }
    throw error;
  }
}

export async function saveMatchSelection(
  cartItemId: string,
  retailerProductId: string,
  matchType: string,
  confidence: number
) {
  const response = await apiClient.post(
    '/match/select',
    { cartItemId, retailerProductId, matchType, confidence },
    { headers: await authHeaders() }
  );
  return response.data;
}

export async function saveMatchCandidates(
  cartItemId: string,
  candidates: Array<{ retailerProductId: string; matchType: string; confidence: number; reason: string }>,
  selectedRetailerProductId?: string
) {
  const response = await apiClient.post(
    '/match/candidates',
    { cartItemId, candidates, selectedRetailerProductId },
    { headers: await authHeaders() }
  );
  return response.data;
}

export async function getCartRedirect(cartItems: any[], store: string): Promise<{
  redirectUrl: string;
  routeType: string;
  message?: string;
}> {
  const response = await apiClient.post('/checkout/redirect', { items: cartItems, store }, { headers: await authHeaders() });
  return response.data;
}

// Get cart redirect URL (for MVP redirect checkout)
export async function getCartRedirectUrl(cartItems: any[], store: string): Promise<string> {
  const data = await getCartRedirect(cartItems, store);
  return data.redirectUrl;
}

export async function validateCheckoutReadiness(cartItems: any[], store: string) {
  const response = await apiClient.post('/checkout/validate', { items: cartItems, store }, { headers: await authHeaders() });
  return response.data;
}

export async function getSupportedCheckoutStores(): Promise<string[]> {
  const response = await apiClient.get('/checkout/stores', { headers: await authHeaders() });
  return response.data.supportedStores;
}

export async function getCheckoutStoreStatuses(cartItems: any[]): Promise<Array<{ name: string; supported: boolean; reason: string; routeType?: string; message?: string; limitations?: string[] }>> {
  const response = await apiClient.post('/checkout/stores', { items: cartItems }, { headers: await authHeaders() });
  return response.data.supportedStores;
}

export async function getCheckoutFinancingOptions(totalAmount: number): Promise<Array<{
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
  rewardsRate: number;
  rewardsValue: number;
  rewardsAdjustedTotal: number;
  totalRepayment: number;
  financingCost: number;
  estimatedMonthlyPayment?: number;
  budgetWarnings: string[];
}>> {
  const response = await apiClient.get('/checkout/financing-options', {
    params: { totalAmount },
    headers: await authHeaders(),
  });
  return response.data.options;
}

export async function compareCartItemPricing(cartItemId: string, destinationRetailerProductId: string) {
  const response = await apiClient.post(
    '/pricing/compare',
    { cartItemId, destinationRetailerProductId },
    { headers: await authHeaders() }
  );
  return response.data;
}

export async function upsertCardLinkedOffers(offers: Array<{
  retailerName: string;
  description: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  termsSummary?: string | null;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minSpend?: number | null;
  maxDiscount?: number | null;
  expiresAt?: string | null;
  activated: boolean;
  consentAccepted: boolean;
}>) {
  const response = await apiClient.put('/profile/card-offers', { offers }, { headers: await authHeaders() });
  return response.data.offers;
}

export async function getBudgetSummary() {
  const response = await apiClient.get('/budget/summary', { headers: await authHeaders() });
  return response.data.summary;
}

export async function setBudgetAlert(alertType: string, targetAmount?: number | null) {
  const response = await apiClient.post('/budget/alerts', { alertType, targetAmount }, { headers: await authHeaders() });
  return response.data;
}
