(function backgroundCoreFactory(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.UniversalCartBackgroundCore = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBackgroundCore(root) {
  const packagedConfig = root?.UniversalCartExtensionConfig || {};
  const DEFAULT_API_BASE_URL = packagedConfig.apiBaseUrl || 'http://localhost:3001/api';
  const DEFAULT_WEB_BASE_URL = packagedConfig.webBaseUrl || 'http://localhost:3000';

  function normalizeApiBaseUrl(apiBaseUrl) {
    return (apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  }

  async function getConfig(storage) {
    const result = await storage.get(['apiBaseUrl', 'webBaseUrl', 'authToken', 'authUserEmail']);
    return {
      apiBaseUrl: result.apiBaseUrl || DEFAULT_API_BASE_URL,
      webBaseUrl: result.webBaseUrl || DEFAULT_WEB_BASE_URL,
      authToken: result.authToken || '',
      authUserEmail: result.authUserEmail || '',
    };
  }

  async function parseJsonResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }
    return data;
  }

  async function apiFetch({ storage, fetchImpl, path, options = {}, allowRefresh = true }) {
    const { apiBaseUrl, authToken } = await getConfig(storage);
    const request = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
    };
    const response = await fetchImpl(`${normalizeApiBaseUrl(apiBaseUrl)}${path}`, request);

    if (response.status === 401 && authToken && allowRefresh) {
      await refreshSession({ storage, fetchImpl }).catch(async () => {
        await storage.remove(['authToken', 'authUserEmail']);
      });
      const refreshedConfig = await getConfig(storage);
      if (refreshedConfig.authToken) {
        return apiFetch({ storage, fetchImpl, path, options, allowRefresh: false });
      }
    }

    return parseJsonResponse(response);
  }

  function importedProductMatches(left, right) {
    if (!left || !right) return false;
    if (left.cartItemId && right.cartItemId && left.cartItemId === right.cartItemId) return true;
    if (left.id && right.id && left.id === right.id) return true;
    if (left.retailerProductId && right.retailerProductId && left.retailerProductId === right.retailerProductId) return true;
    return false;
  }

  function countCartItems(items) {
    return items.reduce((count, item) => count + Number(item.quantity || 1), 0);
  }

  async function cacheImportedProduct(storage, product) {
    const result = await storage.get(['cart']);
    const cart = Array.isArray(result.cart) ? [...result.cart] : [];
    const existingIndex = cart.findIndex((item) => importedProductMatches(item, product));
    const duplicate = existingIndex >= 0;

    if (duplicate) {
      cart[existingIndex] = { ...cart[existingIndex], ...product };
    } else {
      cart.push(product);
    }

    await storage.set({ cart });
    return {
      duplicate,
      cart,
      count: countCartItems(cart),
    };
  }

  async function importProductFromUrl({ storage, fetchImpl, url }) {
    const product = await apiFetch({
      storage,
      fetchImpl,
      path: '/import/url',
      options: {
        method: 'POST',
        body: JSON.stringify({ url }),
      },
    });
    const cache = await cacheImportedProduct(storage, product);
    return { product, ...cache };
  }

  async function addSearchResultToCart({ storage, fetchImpl, result }) {
    const cartItem = await apiFetch({
      storage,
      fetchImpl,
      path: '/cart/items',
      options: {
        method: 'POST',
        body: JSON.stringify({
          productId: result.productId,
          sourceRetailer: result.sourceRetailer,
          quantity: 1,
        }),
      },
    });

    return {
      ...result,
      cartItemId: cartItem.id || cartItem.cartItemId,
      quantity: cartItem.quantity || 1,
      importedVia: 'search',
    };
  }

  async function importFromProductInfo({ storage, fetchImpl, productInfo }) {
    if (!productInfo?.title && !productInfo?.url) {
      throw new Error('Could not detect a product on this page');
    }

    const url = productInfo.url || '';
    if (url) {
      try {
        return await importProductFromUrl({ storage, fetchImpl, url });
      } catch (error) {
        if (!productInfo.title) throw error;
      }
    }

    const search = await apiFetch({
      storage,
      fetchImpl,
      path: '/import/search',
      options: {
        method: 'POST',
        body: JSON.stringify({ query: productInfo.title }),
      },
    });
    const firstResult = Array.isArray(search.results) ? search.results[0] : null;
    if (!firstResult) {
      throw new Error('No supported retailer result found for this product');
    }

    const product = await addSearchResultToCart({ storage, fetchImpl, result: firstResult });
    const cache = await cacheImportedProduct(storage, product);
    return { product, ...cache };
  }

  async function syncRemoteCartCount({ storage, fetchImpl }) {
    const { authToken } = await getConfig(storage);
    if (!authToken) {
      const result = await storage.get(['cart']);
      return countCartItems(result.cart || []);
    }

    const cart = await apiFetch({ storage, fetchImpl, path: '/cart' });
    const items = Array.isArray(cart.items) ? cart.items : [];
    await storage.set({ cart: items });
    return countCartItems(items);
  }

  async function getPreferredStore({ storage, fetchImpl }) {
    const profile = await apiFetch({ storage, fetchImpl, path: '/profile' });
    return profile.preferences?.defaultStore || '';
  }

  function hostnameFromProductInfo(productInfo) {
    try {
      return new URL(productInfo.url).hostname;
    } catch {
      return '';
    }
  }

  function toPriceNumber(value) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function compareDetectedPrices(sourcePrice, destinationPrice) {
    if (sourcePrice == null || destinationPrice == null) {
      return null;
    }

    const difference = Math.round((sourcePrice - destinationPrice + Number.EPSILON) * 100) / 100;
    return {
      sourcePrice,
      destinationPrice,
      difference,
      cheaperAtPreferred: difference > 0,
      label:
        difference > 0
          ? `Preferred store is $${difference.toFixed(2)} cheaper before tax, shipping, and rewards.`
          : difference < 0
            ? `Current store is $${Math.abs(difference).toFixed(2)} cheaper before tax, shipping, and rewards.`
            : 'Current and preferred store prices match before tax, shipping, and rewards.',
    };
  }

  async function comparePreferredMerchant({ storage, fetchImpl, productInfo, preferredStoreOverride = '' }) {
    if (!productInfo?.title) {
      throw new Error('Could not detect a product on this page');
    }

    const preferredStore = preferredStoreOverride || await getPreferredStore({ storage, fetchImpl });
    if (!preferredStore) {
      throw new Error('Set a preferred store in your Universal Cart profile first');
    }

    const match = await apiFetch({
      storage,
      fetchImpl,
      path: '/match',
      options: {
        method: 'POST',
        body: JSON.stringify({
          product: {
            name: productInfo.title,
            price: Number(productInfo.price || 0) || undefined,
            sku: productInfo.sku || undefined,
            brand: productInfo.brand || undefined,
            retailer: productInfo.retailer || hostnameFromProductInfo(productInfo),
          },
          preferredStore,
        }),
      },
    });

    const retailerProduct = match.retailerProduct || {};
    const destinationPrice = toPriceNumber(retailerProduct.price);
    const sourcePrice = toPriceNumber(productInfo.price);
    const priceComparison = compareDetectedPrices(sourcePrice, destinationPrice);
    const checkoutPathAvailable = Boolean(retailerProduct.retailerSku || retailerProduct.url);
    return {
      preferredStore,
      matchType: match.matchType || 'unknown',
      confidence: Number(match.confidence || 0),
      reason: match.reason || '',
      productName: retailerProduct.product?.name || productInfo.title,
      sourcePrice,
      destinationPrice,
      priceComparison,
      destinationUrl: retailerProduct.url || '',
      retailerSku: retailerProduct.retailerSku || '',
      checkoutPathAvailable,
      availabilityStatus: checkoutPathAvailable
        ? `Available at ${preferredStore} with a checkout path.`
        : `Matched at ${preferredStore}, but no checkout path is available yet.`,
    };
  }

  async function authenticate({ storage, fetchImpl, mode, email, password }) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const { apiBaseUrl } = await getConfig(storage);
    const data = await fetchImpl(`${normalizeApiBaseUrl(apiBaseUrl)}/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(parseJsonResponse);

    if (!data.token) {
      throw new Error('Authentication response did not include a token');
    }

    const authUserEmail = data.user?.email || email;
    await storage.set({ authToken: data.token, authUserEmail });
    return { authUserEmail };
  }

  async function refreshSession({ storage, fetchImpl }) {
    const { apiBaseUrl, authToken } = await getConfig(storage);
    if (!authToken) {
      throw new Error('No active extension session');
    }

    const data = await fetchImpl(`${normalizeApiBaseUrl(apiBaseUrl)}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    }).then(parseJsonResponse);

    if (!data.token) {
      throw new Error('Refresh response did not include a token');
    }

    const authUserEmail = data.user?.email || '';
    await storage.set({ authToken: data.token, authUserEmail });
    return { authUserEmail };
  }

  async function logoutSession({ storage, fetchImpl }) {
    const { apiBaseUrl, authToken } = await getConfig(storage);
    if (authToken) {
      await fetchImpl(`${normalizeApiBaseUrl(apiBaseUrl)}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }).catch(() => null);
    }
    await storage.remove(['authToken', 'authUserEmail', 'cart']);
    return { success: true };
  }

  return {
    DEFAULT_API_BASE_URL,
    DEFAULT_WEB_BASE_URL,
    authenticate,
    cacheImportedProduct,
    comparePreferredMerchant,
    getConfig,
    importFromProductInfo,
    importProductFromUrl,
    logoutSession,
    normalizeApiBaseUrl,
    parseJsonResponse,
    compareDetectedPrices,
    refreshSession,
    syncRemoteCartCount,
  };
});
