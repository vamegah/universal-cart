import axios from 'axios';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { app, prisma } from '../../apps/api/src/index';

jest.mock('axios');

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

describe('full import -> match -> optimize -> checkout integration flow', () => {
  const email = `pipeline-${Date.now()}@example.com`;
  const upc = `pipeline-upc-${Date.now()}`;
  const amazonSku = 'B09PIPE123';
  const targetSku = `target-pipeline-${Date.now()}`;
  let authToken: string;
  let userId: string;
  let productId: string;
  let cartId: string;
  let cartItemId: string;
  let targetRetailerProductId: string;

  beforeAll(async () => {
    const tokenRes = await request(app).post('/api/auth/dev-token').send({ email });
    authToken = tokenRes.body.token;
    userId = tokenRes.body.userId;

    const product = await prisma.product.create({
      data: {
        name: 'Pipeline Bluetooth Speaker',
        brand: 'Acme',
        category: 'electronics',
        upc,
      },
    });
    productId = product.id;

    const targetListing = await prisma.retailerProduct.create({
      data: {
        productId,
        retailerName: 'Target',
        retailerSku: targetSku,
        price: 69.99,
        shippingCost: 0,
        taxRate: 0.08,
        url: `https://www.target.com/p/${targetSku}`,
        inStock: true,
      },
    });
    targetRetailerProductId = targetListing.id;
  });

  afterAll(async () => {
    if (userId) await prisma.auditEvent.deleteMany({ where: { userId } });
    if (cartId) await prisma.splitPlan.deleteMany({ where: { cartId } });
    if (cartItemId) await prisma.matchResult.deleteMany({ where: { cartItemId } });
    if (cartItemId) await prisma.cartItem.deleteMany({ where: { id: cartItemId } });
    if (cartId) await prisma.universalCart.deleteMany({ where: { id: cartId } });
    if (targetRetailerProductId || cartItemId) {
      await prisma.retailerProduct.deleteMany({
        where: {
          OR: [
            { retailerSku: amazonSku },
            { retailerSku: targetSku },
          ],
        },
      });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('serves the generated OpenAPI document and documentation UI', async () => {
    const specRes = await request(app).get('/api/docs');
    expect(specRes.status).toBe(200);
    expect(specRes.text).toContain('openapi: 3.1.0');

    const uiRes = await request(app).get('/api/docs/ui');
    expect(uiRes.status).toBe(200);
    expect(uiRes.text).toContain('Swagger UI');
  });

  it('runs the authenticated shopping pipeline through checkout redirect', async () => {
    mockedGet.mockResolvedValueOnce({
      data: `
        <html>
          <span id="productTitle">Pipeline Bluetooth Speaker</span>
          <a id="bylineInfo">Acme</a>
          <span id="priceblock_ourprice">$79.99</span>
          <input id="ASIN" value="${amazonSku}" />
          <img id="landingImage" src="https://example.com/speaker.jpg" />
          <div id="availability"><span>In Stock</span></div>
        </html>
      `,
    } as any);

    const importRes = await request(app)
      .post('/api/import/url')
      .set('authorization', `Bearer ${authToken}`)
      .send({ url: `https://www.amazon.com/dp/${amazonSku}` });
    expect(importRes.status).toBe(200);
    expect(importRes.body.cartItemId).toBeDefined();
    cartItemId = importRes.body.cartItemId;

    const cartRes = await request(app)
      .get('/api/cart')
      .set('authorization', `Bearer ${authToken}`);
    expect(cartRes.status).toBe(200);
    cartId = cartRes.body.id;

    const matchRes = await request(app)
      .post('/api/match')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        product: {
          name: importRes.body.productName,
          brand: importRes.body.brand,
          category: importRes.body.category,
          price: importRes.body.price,
          retailer: 'Amazon',
        },
        preferredStore: 'Target',
      });
    expect(matchRes.status).toBe(200);
    expect(matchRes.body.retailerProduct.id).toBe(targetRetailerProductId);

    const selectRes = await request(app)
      .post('/api/match/select')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        cartItemId,
        retailerProductId: targetRetailerProductId,
        matchType: matchRes.body.matchType,
        confidence: matchRes.body.confidence,
      });
    expect(selectRes.status).toBe(200);
    expect(selectRes.body.isSelected).toBe(true);

    const optimizeRes = await request(app)
      .post('/api/optimize')
      .set('authorization', `Bearer ${authToken}`)
      .send({
        cartId,
        items: [
          {
            itemId: cartItemId,
            costs: {},
            options: {
              Amazon: { price: 79.99, shipping: 0, tax: 0, rewards: 0 },
              Target: { price: 69.99, shipping: 0, tax: 0, rewards: 0 },
            },
          },
        ],
        userStores: ['Amazon', 'Target'],
      });
    expect(optimizeRes.status).toBe(200);
    expect(optimizeRes.body.assignments[0]).toMatchObject({ itemId: cartItemId, store: 'Target' });
    expect(optimizeRes.body.splitPlanId).toBeDefined();

    const checkoutItems = [
      {
        productName: importRes.body.productName,
        retailerSku: amazonSku,
        quantity: 1,
        price: importRes.body.price,
        sourceRetailer: 'Amazon',
      },
    ];

    const validateRes = await request(app)
      .post('/api/checkout/validate')
      .set('authorization', `Bearer ${authToken}`)
      .send({ items: checkoutItems, store: 'Amazon' });
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.ready).toBe(true);

    const redirectRes = await request(app)
      .post('/api/checkout/redirect')
      .set('authorization', `Bearer ${authToken}`)
      .send({ items: checkoutItems, store: 'Amazon' });
    expect(redirectRes.status).toBe(200);
    expect(() => new URL(redirectRes.body.redirectUrl)).not.toThrow();
    expect(redirectRes.body.redirectUrl).toContain('amazon.com/gp/cart/add.html');
  });
});
