import { expect, Page, test } from '@playwright/test';

const importedProduct = {
  id: 'product-airpods',
  cartItemId: 'cart-item-airpods',
  retailerProductId: 'source-listing-amazon',
  retailerSku: 'B09AIRPODS',
  sourceRetailer: 'Amazon',
  productName: 'Apple AirPods Pro',
  price: 199,
  imageUrl: 'https://example.com/airpods.jpg',
  url: 'https://www.amazon.com/dp/B09AIRPODS',
  brand: 'Apple',
  model: 'AirPods Pro',
  upc: '000111222333',
  category: 'electronics',
};

const matchResponse = {
  matchType: 'exact',
  confidence: 0.97,
  reason: 'upc_match; seller_trust_95',
  retailerProduct: {
    id: 'target-airpods',
    retailerName: 'Target',
    retailerSku: 'TGT-AIRPODS',
    price: 179,
    url: 'https://www.target.com/p/apple-airpods-pro/-/A-123',
    inStock: true,
    sellerTrustScore: 95,
    sellerTrustLabel: 'strong',
    sellerTrustSignals: ['authorized seller', '30-day returns'],
  },
  candidates: [
    {
      matchType: 'exact',
      confidence: 0.97,
      reason: 'upc_match',
      retailerProduct: {
        id: 'target-airpods',
      },
    },
  ],
};

async function mockUniversalCartApi(page: Page) {
  let serverCartItems: any[] = [];
  let selectedMatch: any | null = null;

  const serverCartItem = () => ({
    id: importedProduct.cartItemId,
    productId: importedProduct.id,
    sourceRetailer: importedProduct.sourceRetailer,
    quantity: 1,
    product: {
      id: importedProduct.id,
      name: importedProduct.productName,
      imageUrl: importedProduct.imageUrl,
      brand: importedProduct.brand,
      model: importedProduct.model,
      upc: importedProduct.upc,
      category: importedProduct.category,
      retailerProducts: [
        {
          id: importedProduct.retailerProductId,
          retailerName: importedProduct.sourceRetailer,
          retailerSku: importedProduct.retailerSku,
          price: importedProduct.price,
          url: importedProduct.url,
        },
      ],
    },
    matchResults: selectedMatch ? [selectedMatch] : [],
  });

  await page.route('https://www.target.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Target checkout handoff</body></html>',
    });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');

    if (path === '/auth/signup' && request.method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'e2e-token',
          user: { id: 'user-e2e', email: 'shopper-e2e@example.com', createdAt: '2026-04-29T00:00:00.000Z' },
        }),
      });
    }

    if (path === '/auth/me' && request.method() === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-e2e', email: 'shopper-e2e@example.com', createdAt: '2026-04-29T00:00:00.000Z' },
        }),
      });
    }

    if (path === '/cart' && request.method() === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'cart-e2e', items: serverCartItems }),
      });
    }

    if (path === '/cart' && request.method() === 'DELETE') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ removed: 1 }),
      });
    }

    if (path === '/import/url' && request.method() === 'POST') {
      serverCartItems = [serverCartItem()];
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(importedProduct),
      });
    }

    if (path === '/match' && request.method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(matchResponse),
      });
    }

    if (path === '/match/candidates' && request.method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ stored: 1 }),
      });
    }

    if (path === '/match/select' && request.method() === 'POST') {
      selectedMatch = {
        id: 'match-result-1',
        cartItemId: importedProduct.cartItemId,
        retailerProductId: matchResponse.retailerProduct.id,
        matchType: matchResponse.matchType,
        confidenceScore: matchResponse.confidence,
        isSelected: true,
        retailerProduct: matchResponse.retailerProduct,
      };
      serverCartItems = [serverCartItem()];
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'match-result-1', isSelected: true }),
      });
    }

    if (path === '/pricing/compare' && request.method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          cartItemId: importedProduct.cartItemId,
          source: {
            retailerName: 'Amazon',
            totalBeforeRewards: 216,
            effectiveTotal: 210,
            rewardsValue: 6,
          },
          destination: {
            retailerName: 'Target',
            totalBeforeRewards: 194,
            effectiveTotal: 188,
            rewardsValue: 6,
          },
          recommendation: {
            cheaperDestination: true,
            effectiveSavings: 22,
            explanation: 'Target is cheaper after estimated rewards.',
          },
        }),
      });
    }

    if (path === '/checkout/stores' && request.method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          supportedStores: [
            { name: 'Amazon', supported: true, reason: '' },
            { name: 'Walmart', supported: false, reason: 'Single-item routing only' },
            { name: 'Target', supported: true, reason: '' },
            { name: "Macy's", supported: false, reason: 'No verified listing' },
          ],
        }),
      });
    }

    if (path === '/checkout/validate' && request.method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ready: true, warnings: [], errors: [] }),
      });
    }

    if (path === '/checkout/redirect' && request.method() === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          redirectUrl: 'https://www.target.com/cart?product_id=TGT-AIRPODS&quantity=1',
          routeType: 'cart_add',
        }),
      });
    }

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled e2e mock route: ${request.method()} ${path}` }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockUniversalCartApi(page);
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test('authenticated MVP shopping flow imports, matches, compares, and redirects', async ({ page }) => {
  await page.goto('/account');
  await page.getByRole('button', { name: 'Create a new account' }).click();
  await page.locator('input[type="email"]').fill('shopper-e2e@example.com');
  await page.locator('input[type="password"]').fill('correct-password');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Universal cart command center' })).toBeVisible();

  await page.getByPlaceholder(/Paste product URL/).fill('https://www.amazon.com/dp/B09AIRPODS');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.getByText('Apple AirPods Pro').first()).toBeVisible();
  await expect(page.getByText('Product groups').first()).toBeVisible();

  await page.getByRole('link', { name: 'Cart', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Universal cart review' })).toBeVisible();
  await expect(page.getByText('Apple AirPods Pro').first()).toBeVisible();

  await page.locator('select').selectOption('Target');
  await page.getByRole('button', { name: 'Find Matches' }).click();
  await expect(page.getByText('1 matched item.')).toBeVisible();
  await expect(page.getByText(/Routed to Target/)).toBeVisible();
  await expect(page.getByText('Target is cheaper after estimated rewards.')).toBeVisible();

  await page.getByRole('link', { name: 'Proceed to Checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByText('Apple AirPods Pro x1')).toBeVisible();
  await page.locator('select').first().selectOption('Target');

  await page.getByRole('button', { name: 'Checkout with Target' }).click();
  await page.waitForURL('https://www.target.com/cart?product_id=TGT-AIRPODS&quantity=1');
});
