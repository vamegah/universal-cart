const {
  authenticate,
  compareDetectedPrices,
  comparePreferredMerchant,
  importFromProductInfo,
  importProductFromUrl,
  logoutSession,
  normalizeApiBaseUrl,
  refreshSession,
  syncRemoteCartCount,
} = require('../../apps/extension/background-core');

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, data[key]]));
      }
      if (typeof keys === 'string') {
        return { [keys]: data[keys] };
      }
      return { ...data };
    },
    async set(updates) {
      Object.assign(data, updates);
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
    },
  };
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('extension background core', () => {
  it('compares detected current-page and preferred-store prices', () => {
    expect(compareDetectedPrices(59.99, 49.99)).toMatchObject({
      difference: 10,
      cheaperAtPreferred: true,
    });
    expect(compareDetectedPrices(49.99, 59.99)).toMatchObject({
      difference: -10,
      cheaperAtPreferred: false,
    });
    expect(compareDetectedPrices(null, 59.99)).toBeNull();
  });

  it('normalizes API base URLs without stripping path segments', () => {
    expect(normalizeApiBaseUrl('http://localhost:3001/api/')).toBe('http://localhost:3001/api');
    expect(normalizeApiBaseUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1');
  });

  it('imports with the stored bearer token and caches a new product', async () => {
    const storage = fakeStorage({
      apiBaseUrl: 'https://api.example.com/api/',
      authToken: 'signed-token',
    });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
      id: 'product-1',
      cartItemId: 'cart-item-1',
      productName: 'Desk Lamp',
      quantity: 1,
    }));

    const result = await importProductFromUrl({
      storage,
      fetchImpl,
      url: 'https://www.target.com/p/lamp/-/A-123',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/api/import/url',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer signed-token' }),
        body: JSON.stringify({ url: 'https://www.target.com/p/lamp/-/A-123' }),
      })
    );
    expect(result.duplicate).toBe(false);
    expect(result.count).toBe(1);
    expect(storage.data.cart).toHaveLength(1);
    expect(storage.data.cart[0].productName).toBe('Desk Lamp');
  });

  it('updates an existing cached product instead of duplicating it', async () => {
    const storage = fakeStorage({
      authToken: 'signed-token',
      cart: [{ id: 'product-1', cartItemId: 'cart-item-1', productName: 'Old Lamp', quantity: 1 }],
    });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
      id: 'product-1',
      cartItemId: 'cart-item-1',
      productName: 'Updated Lamp',
      quantity: 3,
    }));

    const result = await importProductFromUrl({
      storage,
      fetchImpl,
      url: 'https://www.target.com/p/lamp/-/A-123',
    });

    expect(result.duplicate).toBe(true);
    expect(result.count).toBe(3);
    expect(storage.data.cart).toHaveLength(1);
    expect(storage.data.cart[0]).toMatchObject({
      productName: 'Updated Lamp',
      quantity: 3,
    });
  });

  it('falls back from unsupported URL import to search and cart add', async () => {
    const storage = fakeStorage({
      apiBaseUrl: 'https://api.example.com/api/',
      authToken: 'signed-token',
    });
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unsupported retailer URL' }, { ok: false, status: 422 }))
      .mockResolvedValueOnce(jsonResponse({
        query: 'Desk Lamp',
        results: [{
          productId: 'product-1',
          retailerProductId: 'retailer-product-1',
          sourceRetailer: 'Amazon',
          productName: 'Desk Lamp',
          price: 29.99,
          url: 'https://www.amazon.com/dp/B09LAMP',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: 'cart-item-1',
        productId: 'product-1',
        quantity: 1,
      }));

    const result = await importFromProductInfo({
      storage,
      fetchImpl,
      productInfo: {
        title: 'Desk Lamp',
        url: 'https://unsupported.example/products/lamp',
      },
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/api/import/url',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: 'https://unsupported.example/products/lamp' }),
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/api/import/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'Desk Lamp' }),
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://api.example.com/api/cart/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ productId: 'product-1', sourceRetailer: 'Amazon', quantity: 1 }),
      })
    );
    expect(result.product).toMatchObject({
      productId: 'product-1',
      cartItemId: 'cart-item-1',
      importedVia: 'search',
    });
    expect(result.count).toBe(1);
    expect(storage.data.cart).toHaveLength(1);
  });

  it('syncs cart count from the authenticated backend cart', async () => {
    const storage = fakeStorage({ authToken: 'signed-token' });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
      items: [
        { id: 'a', quantity: 2 },
        { id: 'b', quantity: 1 },
      ],
    }));

    const count = await syncRemoteCartCount({ storage, fetchImpl });

    expect(count).toBe(3);
    expect(storage.data.cart).toEqual([
      { id: 'a', quantity: 2 },
      { id: 'b', quantity: 1 },
    ]);
  });

  it('returns preferred merchant match with live page-vs-destination price comparison', async () => {
    const storage = fakeStorage({
      apiBaseUrl: 'https://api.example.com/api',
      authToken: 'signed-token',
    });
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ preferences: { defaultStore: 'Target' } }))
      .mockResolvedValueOnce(jsonResponse({
        matchType: 'exact',
        confidence: 0.94,
        retailerProduct: {
          id: 'rp-1',
          retailerName: 'Target',
          retailerSku: 'sku-1',
          price: 39.99,
          url: 'https://www.target.com/p/test/-/A-1',
          product: { name: 'Test Product' },
        },
      }));

    const comparison = await comparePreferredMerchant({
      storage,
      fetchImpl,
      productInfo: {
        title: 'Test Product',
        price: '$49.99',
        retailer: 'Amazon',
      },
    });

    expect(comparison).toMatchObject({
      preferredStore: 'Target',
      matchType: 'exact',
      destinationPrice: 39.99,
      checkoutPathAvailable: true,
      availabilityStatus: 'Available at Target with a checkout path.',
      priceComparison: {
        sourcePrice: 49.99,
        destinationPrice: 39.99,
        difference: 10,
        cheaperAtPreferred: true,
      },
    });
    expect(comparison.priceComparison.label).toContain('Preferred store');
  });

  it('falls back to local cart count when signed out', async () => {
    const storage = fakeStorage({
      cart: [
        { id: 'a', quantity: 2 },
        { id: 'b' },
      ],
    });
    const fetchImpl = jest.fn();

    const count = await syncRemoteCartCount({ storage, fetchImpl });

    expect(count).toBe(3);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stores token and user email after extension login', async () => {
    const storage = fakeStorage({ apiBaseUrl: 'http://localhost:3001/api' });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
      token: 'fresh-token',
      user: { email: 'shopper@example.com' },
    }));

    const session = await authenticate({
      storage,
      fetchImpl,
      mode: 'login',
      email: 'shopper@example.com',
      password: 'correct-password',
    });

    expect(session.authUserEmail).toBe('shopper@example.com');
    expect(storage.data.authToken).toBe('fresh-token');
    expect(storage.data.authUserEmail).toBe('shopper@example.com');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'shopper@example.com', password: 'correct-password' }),
      })
    );
  });

  it('refreshes the stored token and session email', async () => {
    const storage = fakeStorage({
      apiBaseUrl: 'https://api.example.com/api',
      authToken: 'old-token',
      authUserEmail: 'old@example.com',
    });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
      token: 'new-token',
      user: { email: 'shopper@example.com' },
    }));

    const session = await refreshSession({ storage, fetchImpl });

    expect(session.authUserEmail).toBe('shopper@example.com');
    expect(storage.data.authToken).toBe('new-token');
    expect(storage.data.authUserEmail).toBe('shopper@example.com');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer old-token' }),
      })
    );
  });

  it('retries an authenticated API request once after refreshing a stale token', async () => {
    const storage = fakeStorage({
      apiBaseUrl: 'https://api.example.com/api',
      authToken: 'old-token',
    });
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, { ok: false, status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ token: 'new-token', user: { email: 'shopper@example.com' } }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'a', quantity: 2 }] }));

    const count = await syncRemoteCartCount({ storage, fetchImpl });

    expect(count).toBe(2);
    expect(storage.data.authToken).toBe('new-token');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://api.example.com/api/cart',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer new-token' }),
      })
    );
  });

  it('logs out through the backend and clears extension session state', async () => {
    const storage = fakeStorage({
      apiBaseUrl: 'https://api.example.com/api',
      authToken: 'signed-token',
      authUserEmail: 'shopper@example.com',
      cart: [{ id: 'a' }],
    });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ success: true }));

    const result = await logoutSession({ storage, fetchImpl });

    expect(result.success).toBe(true);
    expect(storage.data.authToken).toBeUndefined();
    expect(storage.data.authUserEmail).toBeUndefined();
    expect(storage.data.cart).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer signed-token' }),
      })
    );
  });
});
