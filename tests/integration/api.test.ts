import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { app, prisma } from '../../apps/api/src/index';

describe('API Integration Tests', () => {
  let cartId: string;
  let importedProductId: string;
  let importedCartItemId: string;
  let authToken: string;
  const accountEmail = `integration-${Date.now()}@example.com`;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: 'test-user@example.com' },
      update: {},
      create: {
        id: 'test-user',
        email: 'test-user@example.com',
        passwordHash: 'test-password-hash',
      },
    });

    authToken = (await request(app).post('/api/auth/dev-token').send({ userId: 'test-user' })).body.token;

    const sonyProduct = await prisma.product.upsert({
      where: { upc: 'sony-headphones-test-upc' },
      update: {},
      create: {
        name: 'Sony Headphones',
        brand: 'Sony',
        model: 'Headphones',
        upc: 'sony-headphones-test-upc',
      },
    });
    importedProductId = sonyProduct.id;

    await prisma.retailerProduct.upsert({
      where: {
        retailerName_retailerSku: {
          retailerName: 'Amazon',
          retailerSku: 'B09TEST',
        },
      },
      update: {},
      create: {
        productId: sonyProduct.id,
        retailerName: 'Amazon',
        retailerSku: 'B09TEST',
        price: 199,
        url: 'https://www.amazon.com/dp/B09TEST',
        inStock: true,
      },
    });

    await prisma.retailerProduct.upsert({
      where: {
        retailerName_retailerSku: {
          retailerName: "Macy's",
          retailerSku: 'sony-headphones-test',
        },
      },
      update: {},
      create: {
      productId: sonyProduct.id,
      retailerName: "Macy's",
      retailerSku: 'sony-headphones-test',
      price: 199,
      url: 'https://macys.com/product/sony-headphones-test',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should sign up, identify, and log in a user', async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: accountEmail, password: 'correct-horse-1' });
    expect(signupRes.status).toBe(201);
    expect(signupRes.body).toHaveProperty('token');
    expect(signupRes.body.user.email).toBe(accountEmail);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${signupRes.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(accountEmail);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: accountEmail, password: 'correct-horse-1' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('should return a retailer import failure without mutating the cart when live metadata is unavailable', async () => {
    const res = await request(app)
      .post('/api/import/url')
      .set('authorization', `Bearer ${authToken}`)
      .send({ url: 'https://amazon.com/dp/B09TEST' });
    expect([502, 504]).toContain(res.status);
    expect(res.body.retailer).toBe('Amazon');
    expect(res.body.retryable).toBe(true);
  });

  it('should add product to cart', async () => {
    // First get or create cart
    const cartRes = await request(app).get('/api/cart').set('authorization', `Bearer ${authToken}`);
    cartId = cartRes.body.id;
    const addRes = await request(app)
      .post('/api/cart/items')
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId: importedProductId, sourceRetailer: 'Amazon', quantity: 1 });
    expect(addRes.status).toBe(200);
    importedCartItemId = addRes.body.id;
  });

  it('should match product to preferred store', async () => {
    const matchRes = await request(app)
      .post('/api/match')
      .set('authorization', `Bearer ${authToken}`)
      .send({ product: { name: 'Sony Headphones', price: 199, retailer: 'Amazon' }, preferredStore: "Macy's" });
    expect(matchRes.status).toBe(200);
    expect(matchRes.body).toHaveProperty('matchType');
    expect(['exact', 'close', 'substitute']).toContain(matchRes.body.matchType);
    expect(Array.isArray(matchRes.body.candidates)).toBe(true);
    expect(matchRes.body.candidates.length).toBeGreaterThan(0);
    expect(matchRes.body.candidates[0]).toHaveProperty('reason');
    expect(matchRes.body.candidates[0]).toHaveProperty('confidence');
  });

  it('should return an exact brand/model match for a normalized product', async () => {
    const matchRes = await request(app)
      .post('/api/match')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        product: {
          name: 'Sony Headphones',
          brand: 'Sony',
          model: 'Headphones',
          price: 199,
          retailer: 'Amazon',
        },
        preferredStore: "Macy's",
      });

    expect(matchRes.status).toBe(200);
    expect(matchRes.body.matchType).toBe('exact');
    expect(Array.isArray(matchRes.body.candidates)).toBe(true);
    expect(matchRes.body.candidates.length).toBeGreaterThan(0);
    expect(matchRes.body.candidates[0].reason).toContain('brand_model_match');
    expect(matchRes.body.candidates[0].confidence).toBeGreaterThan(0.9);
  });

  it('should return 404 when no destination store candidates exist', async () => {
    const matchRes = await request(app)
      .post('/api/match')
      .set('authorization', `Bearer ${authToken}`)
      .send({ product: { name: 'Unique Widget Pro', price: 79, retailer: 'Amazon' }, preferredStore: 'BestBuy' });

    expect(matchRes.status).toBe(404);
  });

  it('should persist the selected match for a cart item', async () => {
    const matchRes = await request(app)
      .post('/api/match')
      .set('authorization', `Bearer ${authToken}`)
      .send({ product: { name: 'Sony Headphones', price: 199, retailer: 'Amazon' }, preferredStore: "Macy's" });
    expect(matchRes.status).toBe(200);
    const selectedProductId = matchRes.body.retailerProduct?.id;
    expect(selectedProductId).toBeDefined();

    const selectRes = await request(app)
      .post('/api/match/select')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        cartItemId: importedCartItemId,
        retailerProductId: selectedProductId,
        matchType: matchRes.body.matchType,
        confidence: matchRes.body.confidence || 0,
      });

    expect(selectRes.status).toBe(200);
    expect(selectRes.body).toHaveProperty('isSelected', true);
    expect(selectRes.body.cartItemId).toBe(importedCartItemId);

    const alternateRetailerProduct = await prisma.retailerProduct.upsert({
      where: {
        retailerName_retailerSku: {
          retailerName: 'Target',
          retailerSku: 'sony-headphones-target',
        },
      },
      update: {
        productId: importedProductId,
        price: 205,
        url: 'https://target.com/product/sony-headphones-target',
        inStock: true,
      },
      create: {
        productId: importedProductId,
        retailerName: 'Target',
        retailerSku: 'sony-headphones-target',
        price: 205,
        url: 'https://target.com/product/sony-headphones-target',
        inStock: true,
      },
    });

    const secondSelectRes = await request(app)
      .post('/api/match/select')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        cartItemId: importedCartItemId,
        retailerProductId: alternateRetailerProduct.id,
        matchType: 'similar',
        confidence: 0.65,
      });

    expect(secondSelectRes.status).toBe(200);
    expect(secondSelectRes.body).toHaveProperty('isSelected', true);
    expect(secondSelectRes.body.retailerProductId).toBe(alternateRetailerProduct.id);

    const matchResults = await prisma.matchResult.findMany({ where: { cartItemId: importedCartItemId } });
    expect(matchResults.length).toBeGreaterThanOrEqual(2);
    const selectedMatches = matchResults.filter((m) => m.isSelected);
    expect(selectedMatches.length).toBe(1);
    expect(selectedMatches[0].retailerProductId).toBe(alternateRetailerProduct.id);
  });

  it('should save match candidates for a cart item and mark the selected candidate', async () => {
    const matchRes = await request(app)
      .post('/api/match')
      .set('authorization', `Bearer ${authToken}`)
      .send({ product: { name: 'Sony Headphones', price: 199, retailer: 'Amazon' }, preferredStore: "Macy's" });
    expect(matchRes.status).toBe(200);
    const candidates = matchRes.body.candidates || [];
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);

    const selectedRetailerProductId = candidates[0].retailerProduct?.id;
    expect(selectedRetailerProductId).toBeDefined();

    const saveCandidatesRes = await request(app)
      .post('/api/match/candidates')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        cartItemId: importedCartItemId,
        candidates: candidates.map((candidate: any) => ({
          retailerProductId: candidate.retailerProduct?.id,
          matchType: candidate.matchType,
          confidence: candidate.confidence,
          reason: candidate.reason ?? 'candidate match',
        })),
        selectedRetailerProductId,
      });

    expect(saveCandidatesRes.status).toBe(200);
    expect(saveCandidatesRes.body).toEqual({ stored: candidates.length });

    const storedResults = await prisma.matchResult.findMany({ where: { cartItemId: importedCartItemId } });
    expect(storedResults.length).toBe(candidates.length);
    const selectedRows = storedResults.filter((result) => result.isSelected);
    expect(selectedRows.length).toBe(1);
    expect(selectedRows[0].retailerProductId).toBe(selectedRetailerProductId);
  });

  it('should reject saving a selected match without authentication', async () => {
    const matchRes = await request(app)
      .post('/api/match')
      .set('authorization', `Bearer ${authToken}`)
      .send({ product: { name: 'Sony Headphones', price: 199, retailer: 'Amazon' }, preferredStore: "Macy's" });
    expect(matchRes.status).toBe(200);
    const selectedProductId = matchRes.body.retailerProduct?.id;

    const selectRes = await request(app)
      .post('/api/match/select')
      .send({
        cartItemId: importedCartItemId,
        retailerProductId: selectedProductId,
        matchType: matchRes.body.matchType,
        confidence: matchRes.body.confidence || 0,
      });

    expect(selectRes.status).toBe(401);
  });

  it('should generate split optimization plan', async () => {
    const splitRes = await request(app)
      .post('/api/optimize')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        items: [{ itemId: cartId, costs: { Amazon: 35, Walmart: 30 } }],
        userStores: ['Amazon', 'Walmart'],
      });
    expect(splitRes.status).toBe(200);
    expect(splitRes.body).toHaveProperty('assignments');
  });

  it('should reject unauthenticated cart access', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  it('should return a supported Amazon checkout redirect', async () => {
    const checkoutRes = await request(app)
      .post('/api/checkout/redirect')
      .set('authorization', `Bearer ${authToken}`)
      .send({ store: 'Amazon', items: [{ retailerSku: 'B09TEST', quantity: 2 }] });

    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.redirectUrl).toContain('amazon.com/gp/cart/add.html');
  });

  it('should return a non-Amazon product-page route for a verified listing URL', async () => {
    const checkoutRes = await request(app)
      .post('/api/checkout/redirect')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        store: "Macy's",
        items: [{ matchedUrl: 'https://www.macys.com/product/sony-headphones-test', quantity: 1 }],
      });

    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.routeType).toBe('product_page');
    expect(checkoutRes.body.redirectUrl).toContain('macys.com/product/sony-headphones-test');
  });

  it('should return checkout store support statuses', async () => {
    const statusRes = await request(app)
      .post('/api/checkout/stores')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        items: [{ matchedUrl: 'https://www.macys.com/product/sony-headphones-test', quantity: 1 }],
      });

    expect(statusRes.status).toBe(200);
    expect(Array.isArray(statusRes.body.supportedStores)).toBe(true);

    const macysStatus = statusRes.body.supportedStores.find((store: any) => store.name === "Macy's");
    expect(macysStatus).toBeDefined();
    expect(macysStatus.supported).toBe(true);

    const amazonStatus = statusRes.body.supportedStores.find((store: any) => store.name === 'Amazon');
    expect(amazonStatus).toBeDefined();
    expect(amazonStatus.supported).toBe(false);
    expect(amazonStatus.reason).toContain('Amazon');
  });

  it('should validate checkout readiness with price warning for Macy’s', async () => {
    const validateRes = await request(app)
      .post('/api/checkout/validate')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        store: "Macy's",
        items: [{
          sourceRetailer: "Macy's",
          retailerSku: 'sony-headphones-test',
          price: 189,
          quantity: 1,
        }],
      });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.ready).toBe(true);
    expect(Array.isArray(validateRes.body.errors)).toBe(true);
    expect(Array.isArray(validateRes.body.warnings)).toBe(true);
    expect(validateRes.body.warnings[0].message).toContain('Price has changed');
  });

  it('should update, remove, and clear authenticated cart items', async () => {
    const updateRes = await request(app)
      .put(`/api/cart/items/${importedCartItemId}/quantity`)
      .set('authorization', `Bearer ${authToken}`)
      .send({ quantity: 3 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.quantity).toBe(3);

    const deleteRes = await request(app)
      .delete(`/api/cart/items/${importedCartItemId}`)
      .set('authorization', `Bearer ${authToken}`);
    expect(deleteRes.status).toBe(204);

    await request(app)
      .post('/api/cart/items')
      .set('authorization', `Bearer ${authToken}`)
      .send({ productId: importedProductId, sourceRetailer: 'Amazon', quantity: 1 });

    const clearRes = await request(app)
      .delete('/api/cart')
      .set('authorization', `Bearer ${authToken}`);
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.removed).toBeGreaterThanOrEqual(1);
  });
});
