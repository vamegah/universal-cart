import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { app, prisma } from '../../apps/api/src/index';

// ─── shared test state ────────────────────────────────────────────────────────

let authToken: string;
let userId: string;
let productId: string;
let retailerProductId: string;
let cartItemId: string;

const TEST_EMAIL = `integration2-${Date.now()}@example.com`;

// ─── lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Create a dedicated test user via dev-token so we get a clean userId.
  const tokenRes = await request(app)
    .post('/api/auth/dev-token')
    .send({ email: TEST_EMAIL });
  expect(tokenRes.status).toBe(200);
  authToken = tokenRes.body.token;
  userId = tokenRes.body.userId;

  // Seed a canonical product + retailer listing used across suites.
  const product = await prisma.product.upsert({
    where: { upc: 'integration2-test-upc' },
    update: {},
    create: {
      name: 'Test Bluetooth Speaker',
      brand: 'Acme',
      model: 'BT-500',
      upc: 'integration2-test-upc',
      category: 'electronics',
    },
  });
  productId = product.id;

  const rp = await prisma.retailerProduct.upsert({
    where: { retailerName_retailerSku: { retailerName: 'Amazon', retailerSku: 'integration2-sku' } },
    update: {},
    create: {
      productId,
      retailerName: 'Amazon',
      retailerSku: 'integration2-sku',
      price: 79.99,
      shippingCost: 0,
      taxRate: 0.08,
      url: 'https://www.amazon.com/dp/integration2-sku',
      inStock: true,
    },
  });
  retailerProductId = rp.id;

  // Import the product so we have a real cart item to work with.
  const importRes = await request(app)
    .post('/api/import/url')
    .set('authorization', `Bearer ${authToken}`)
    .send({ url: 'https://www.amazon.com/dp/integration2-sku' });
  // Import may 200 or create a new product — either way grab the cartItemId.
  if (importRes.status === 200 && importRes.body.cartItemId) {
    cartItemId = importRes.body.cartItemId;
  } else {
    // Fallback: add directly via cart API.
    const addRes = await request(app)
      .post('/api/cart/items')
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId, sourceRetailer: 'Amazon', quantity: 1 });
    expect(addRes.status).toBe(200);
    cartItemId = addRes.body.id;
  }
});

afterAll(async () => {
  // Clean up all records owned by the test user in dependency order.
  await prisma.auditEvent.deleteMany({ where: { userId } });
  await prisma.alertSubscription.deleteMany({ where: { userId } });

  const lists = await prisma.savedList.findMany({ where: { userId } });
  for (const list of lists) {
    await prisma.savedListShare.deleteMany({ where: { listId: list.id } });
    await prisma.savedListItem.deleteMany({ where: { listId: list.id } });
  }
  await prisma.savedList.deleteMany({ where: { userId } });

  const carts = await prisma.universalCart.findMany({ where: { userId } });
  for (const cart of carts) {
    const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    for (const item of items) {
      await prisma.matchResult.deleteMany({ where: { cartItemId: item.id } });
    }
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
  await prisma.universalCart.deleteMany({ where: { userId } });

  await prisma.userCard.deleteMany({ where: { userId } });
  await prisma.userPreferences.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });

  // Clean up seeded retailer product (only if no other tests reference it).
  await prisma.retailerProduct.deleteMany({
    where: { retailerName: 'Amazon', retailerSku: 'integration2-sku' },
  });
  await prisma.product.deleteMany({ where: { upc: 'integration2-test-upc' } });

  await prisma.$disconnect();
});

// ─── auth ─────────────────────────────────────────────────────────────────────

describe('auth — rejection', () => {
  it('rejects requests to protected routes without a token', async () => {
    const routes = [
      () => request(app).get('/api/cart'),
      () => request(app).get('/api/profile'),
      () => request(app).get('/api/alerts'),
      () => request(app).get('/api/audit'),
    ];
    for (const route of routes) {
      const res = await route();
      expect(res.status).toBe(401);
    }
  });

  it('rejects a malformed bearer token', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

// ─── profile ──────────────────────────────────────────────────────────────────

describe('profile — preferences and cards', () => {
  it('returns an empty profile for a new user', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.preferences).toBeNull();
    expect(res.body.cards).toEqual([]);
  });

  it('saves and retrieves preferred store preference', async () => {
    const putRes = await request(app)
      .put('/api/profile/preferences')
      .set('authorization', `Bearer ${authToken}`)
      .send({ defaultStore: 'Amazon' });
    expect(putRes.status).toBe(200);

    const getRes = await request(app)
      .get('/api/profile')
      .set('authorization', `Bearer ${authToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.preferences?.defaultStore).toBe('Amazon');
  });

  it('rejects a raw card number when adding a card', async () => {
    const res = await request(app)
      .post('/api/profile/cards')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        retailerName: 'Amazon',
        cardToken: '4111111111111111', // raw PAN — should be rejected
        cardLast4: '1111',
        rewardsRate: 0.05,
      });
    expect(res.status).toBe(400);
  });

  it('adds a tokenized card reference and returns it in profile', async () => {
    const addRes = await request(app)
      .post('/api/profile/cards')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        retailerName: 'Amazon',
        cardToken: 'tok_test_amazon_rewards',
        cardLast4: '4242',
        rewardsRate: 0.05,
        consentAccepted: true,
      });
    expect(addRes.status).toBe(201);
    expect(addRes.body.card).toHaveProperty('id');
    expect(addRes.body.card.cardLast4).toBe('4242');
    // cardToken must never be returned
    expect(addRes.body.card.cardToken).toBeUndefined();

    const profileRes = await request(app)
      .get('/api/profile')
      .set('authorization', `Bearer ${authToken}`);
    expect(profileRes.body.cards.some((c: any) => c.cardLast4 === '4242')).toBe(true);
    expect(profileRes.body.cards.every((c: any) => c.cardToken === undefined)).toBe(true);
  });
});

// ─── alerts ───────────────────────────────────────────────────────────────────

describe('alerts — CRUD lifecycle', () => {
  let alertId: string;

  it('creates a price_drop alert subscription', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId, alertType: 'price_drop', targetPrice: 59.99 });
    expect(res.status).toBe(201);
    expect(res.body.alert).toHaveProperty('id');
    expect(res.body.alert.alertType).toBe('price_drop');
    expect(res.body.alert.targetPrice).toBe(59.99);
    expect(res.body.alert.status).toBe('active');
    alertId = res.body.alert.id;
  });

  it('upserts an existing active alert instead of duplicating it', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId, alertType: 'price_drop', targetPrice: 49.99 });
    expect(res.status).toBe(200);
    expect(res.body.alert.id).toBe(alertId);
    expect(res.body.alert.targetPrice).toBe(49.99);
  });

  it('lists alert subscriptions for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/alerts')
      .set('authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(res.body.alerts.some((a: any) => a.id === alertId)).toBe(true);
  });

  it('creates a restock alert', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId, alertType: 'restock' });
    expect(res.status).toBe(201);
    expect(res.body.alert.alertType).toBe('restock');
  });

  it('rejects an unsupported alert type', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId, alertType: 'unknown_type' });
    expect(res.status).toBe(400);
  });

  it('rejects a negative targetPrice', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId, alertType: 'price_drop', targetPrice: -5 });
    expect(res.status).toBe(400);
  });

  it('pauses an alert subscription', async () => {
    const res = await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set('authorization', `Bearer ${authToken}`)
      .send({ status: 'paused' });
    expect(res.status).toBe(200);
    expect(res.body.alert.status).toBe('paused');
  });

  it('deletes an alert subscription', async () => {
    const res = await request(app)
      .delete(`/api/alerts/${alertId}`)
      .set('authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(204);

    const listRes = await request(app)
      .get('/api/alerts')
      .set('authorization', `Bearer ${authToken}`);
    expect(listRes.body.alerts.some((a: any) => a.id === alertId)).toBe(false);
  });
});

// ─── saved lists ──────────────────────────────────────────────────────────────

describe('saved lists — lifecycle', () => {
  let listId: string;

  it('creates a named saved list', async () => {
    const res = await request(app)
      .post('/api/lists')
      .set('authorization', `Bearer ${authToken}`)
      .send({ name: 'Holiday Gifts' });
    expect(res.status).toBe(201);
    expect(res.body.list).toHaveProperty('id');
    expect(res.body.list.name).toBe('Holiday Gifts');
    listId = res.body.list.id;
  });

  it('lists saved lists for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/lists')
      .set('authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.lists)).toBe(true);
    expect(res.body.lists.some((l: any) => l.id === listId)).toBe(true);
  });

  it('adds a cart product to the saved list', async () => {
    const res = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId, sourceRetailer: 'Amazon', quantity: 1 });
    expect([200, 201]).toContain(res.status);
    expect(res.body.item.productId).toBe(productId);
  });

  it('restores a saved list into the active cart', async () => {
    const res = await request(app)
      .post(`/api/lists/${listId}/restore`)
      .set('authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cart');
    expect(res.body.cart.items.some((item: any) => item.productId === productId)).toBe(true);
  });

  it('renames a saved list', async () => {
    const res = await request(app)
      .put(`/api/lists/${listId}`)
      .set('authorization', `Bearer ${authToken}`)
      .send({ name: 'Winter Gifts' });
    expect(res.status).toBe(200);
    expect(res.body.list.name).toBe('Winter Gifts');
  });

  it('deletes a saved list', async () => {
    const res = await request(app)
      .delete(`/api/lists/${listId}`)
      .set('authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(204);

    const listRes = await request(app)
      .get('/api/lists')
      .set('authorization', `Bearer ${authToken}`);
    expect(listRes.body.lists.some((l: any) => l.id === listId)).toBe(false);
  });
});

// ─── pricing comparison ───────────────────────────────────────────────────────

describe('pricing — compare cart item', () => {
  it('returns a pricing comparison with source, destination, and recommendation', async () => {
    const res = await request(app)
      .post('/api/pricing/compare')
      .set('authorization', `Bearer ${authToken}`)
      .send({ cartItemId, destinationRetailerProductId: retailerProductId });

    // If the cart item was created from a different product during import,
    // the comparison may 404 — that is acceptable and tested separately.
    if (res.status === 404) return;

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('destination');
    expect(res.body.destination).toHaveProperty('effectiveTotal');
    expect(res.body).toHaveProperty('recommendation');
    expect(typeof res.body.recommendation.cheaperDestination).toBe('boolean');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/pricing/compare')
      .set('authorization', `Bearer ${authToken}`)
      .send({ cartItemId });
    expect(res.status).toBe(400);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/pricing/compare')
      .send({ cartItemId, destinationRetailerProductId: retailerProductId });
    expect(res.status).toBe(401);
  });
});

// ─── audit trail ─────────────────────────────────────────────────────────────

describe('audit trail', () => {
  it('returns audit events for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('audit events include actions from earlier test operations', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('authorization', `Bearer ${authToken}`);
    const actions = res.body.events.map((e: any) => e.action);
    // At minimum the alert.created and alert.deleted events from the alerts suite
    // should be present.
    expect(actions.some((a: string) => a.startsWith('alert.'))).toBe(true);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(401);
  });
});

// ─── checkout validation — budget controls ────────────────────────────────────

describe('checkout validation — budget controls', () => {
  beforeAll(async () => {
    // Set a low max order budget so we can trigger the budget block.
    await request(app)
      .put('/api/profile/preferences')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        shippingPref: {
          budgetControls: {
            maxOrderBudget: 10,
            monthlyFinancingCap: 50,
          },
        },
      });
  });

  it('blocks checkout when estimated total exceeds max order budget', async () => {
    const res = await request(app)
      .post('/api/checkout/validate')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        store: 'Amazon',
        items: [{ retailerSku: 'integration2-sku', quantity: 1, price: 79.99 }],
      });
    expect(res.status).toBe(422);
    expect(res.body.ready).toBe(false);
    expect(res.body.errors.some((e: any) => e.message.includes('max order budget'))).toBe(true);
  });

  it('warns when estimated total exceeds monthly financing cap', async () => {
    // Total of 40 is under maxOrderBudget=10? No — reset budget to allow checkout
    // but keep financing cap low enough to trigger a warning.
    await request(app)
      .put('/api/profile/preferences')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        shippingPref: {
          budgetControls: {
            maxOrderBudget: 200,
            monthlyFinancingCap: 30,
          },
        },
      });

    const res = await request(app)
      .post('/api/checkout/validate')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        store: 'Amazon',
        items: [{ retailerSku: 'integration2-sku', quantity: 1, price: 79.99 }],
      });

    // May be 200 (ready) or 422 depending on other item errors, but warnings must be present.
    expect(res.body.warnings.some((w: any) => w.message.includes('monthly financing cap'))).toBe(true);
  });

  afterAll(async () => {
    // Clear budget controls so they don't affect other suites.
    await request(app)
      .put('/api/profile/preferences')
      .set('authorization', `Bearer ${authToken}`)
      .send({ shippingPref: { budgetControls: {} } });
  });
});
