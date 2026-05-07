import axios from 'axios';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BestBuyAdapter } from '../../apps/api/src/integrations/bestbuy/adapter';

jest.mock('axios');

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

describe('BestBuyAdapter', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('parses Best Buy product metadata from JSON-LD', async () => {
    mockedGet.mockResolvedValue({
      data: `
        <html><head>
          <script type="application/ld+json">
            {
              "@type": "Product",
              "name": "Sony WH-1000XM5 Wireless Noise Canceling Headphones",
              "sku": "6505727",
              "image": "https://images.example.com/sony.jpg",
              "brand": { "name": "Sony" },
              "offers": {
                "price": "349.99",
                "availability": "https://schema.org/InStock"
              }
            }
          </script>
        </head><body></body></html>
      `,
    });

    const adapter = new BestBuyAdapter();
    const result = await adapter.fetchProduct('https://www.bestbuy.com/site/sony-headphones/6505727.p');

    expect(mockedGet).toHaveBeenCalledWith(
      'https://www.bestbuy.com/site/sony-headphones/6505727.p',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining('text/html'),
        }),
      })
    );
    expect(result).toMatchObject({
      name: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
      price: 349.99,
      sku: '6505727',
      image: 'https://images.example.com/sony.jpg',
      brand: 'Sony',
      availability: 'https://schema.org/InStock',
      sourceUrl: 'https://www.bestbuy.com/site/sony-headphones/6505727.p',
    });
  });

  it('falls back to Best Buy page selectors and embedded data', async () => {
    mockedGet.mockResolvedValue({
      data: `
        <html>
          <head><meta property="og:image" content="https://images.example.com/laptop.jpg"></head>
          <body>
            <h1 data-testid="product-title">Lenovo Yoga 9i 2-in-1 Laptop</h1>
            <div data-testid="customer-price">$1,299.99</div>
            <script>
              window.__PRODUCT__ = {"skuId":"6571364","brand":"Lenovo","availability":"InStock"};
            </script>
          </body>
        </html>
      `,
    });

    const adapter = new BestBuyAdapter();
    const result = await adapter.fetchProduct('https://www.bestbuy.com/site/lenovo-yoga/6571364.p');

    expect(result).toMatchObject({
      name: 'Lenovo Yoga 9i 2-in-1 Laptop',
      price: 1299.99,
      sku: '6571364',
      image: 'https://images.example.com/laptop.jpg',
      brand: 'Lenovo',
      availability: 'InStock',
    });
  });

  it('throws a descriptive error when required fields are missing', async () => {
    mockedGet.mockResolvedValue({
      data: '<html><body><h1 data-testid="product-title">Mystery Product</h1></body></html>',
    });

    const adapter = new BestBuyAdapter();

    await expect(adapter.fetchProduct('https://www.bestbuy.com/site/mystery/1234567.p')).rejects.toThrow(
      'Missing: price'
    );
  });
});
