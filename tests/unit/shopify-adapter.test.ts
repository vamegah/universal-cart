import axios from 'axios';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ShopifyAdapter } from '../../apps/api/src/integrations/shopify/adapter';

jest.mock('axios');

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

describe('ShopifyAdapter', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('uses the Shopify product JSON API when a product handle is present', async () => {
    mockedGet.mockResolvedValue({
      data: {
        product: {
          id: 111,
          title: 'Organic Cotton Tee',
          handle: 'organic-cotton-tee',
          vendor: 'Northwind',
          product_type: 'Apparel',
          tags: 'cotton,tee',
          image: { src: 'https://cdn.example.com/tee.jpg' },
          variants: [
            {
              id: 222,
              title: 'Blue / M',
              sku: 'TEE-BLUE-M',
              price: '24.50',
              available: true,
              option1: 'Blue',
              option2: 'M',
              barcode: '012345678905',
              featured_image: { src: 'https://cdn.example.com/tee-blue.jpg' },
            },
          ],
        },
      },
    });

    const adapter = new ShopifyAdapter();
    const result = await adapter.fetchProduct('https://northwind.myshopify.com/products/organic-cotton-tee?variant=222');

    expect(mockedGet).toHaveBeenCalledWith(
      'https://northwind.myshopify.com/products/organic-cotton-tee.json',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining('application/json'),
        }),
      })
    );
    expect(result).toMatchObject({
      name: 'Organic Cotton Tee',
      price: 24.5,
      sku: 'TEE-BLUE-M',
      image: 'https://cdn.example.com/tee-blue.jpg',
      brand: 'Northwind',
      model: 'Blue / M',
      upc: '012345678905',
      category: 'Apparel',
      availability: 'InStock',
      sourceUrl: 'https://northwind.myshopify.com/products/organic-cotton-tee?variant=222',
    });
    expect(result.attributes).toMatchObject({
      handle: 'organic-cotton-tee',
      option1: 'Blue',
      option2: 'M',
      tags: 'cotton,tee',
    });
  });

  it('falls back to HTML metadata when the JSON endpoint is unavailable', async () => {
    mockedGet
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce({
        data: `
          <html>
            <head>
              <meta property="og:title" content="Pour Over Kettle">
              <meta property="og:image" content="https://cdn.example.com/kettle.jpg">
              <meta property="product:price:amount" content="78.00">
              <meta property="product:brand" content="Fellow">
            </head>
            <body>
              <script>window.product = {"sku":"KETTLE-1","availability":"InStock"};</script>
            </body>
          </html>
        `,
      });

    const adapter = new ShopifyAdapter();
    const result = await adapter.fetchProduct('https://northwind.myshopify.com/products/pour-over-kettle');

    expect(mockedGet).toHaveBeenNthCalledWith(
      2,
      'https://northwind.myshopify.com/products/pour-over-kettle',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining('text/html'),
        }),
      })
    );
    expect(result).toMatchObject({
      name: 'Pour Over Kettle',
      price: 78,
      sku: 'KETTLE-1',
      image: 'https://cdn.example.com/kettle.jpg',
      brand: 'Fellow',
      availability: 'InStock',
    });
  });

  it('throws a descriptive error when Shopify JSON lacks required fields', async () => {
    mockedGet.mockResolvedValue({
      data: {
        product: {
          id: 111,
          title: 'Incomplete Product',
          variants: [{ id: 222, available: true }],
        },
      },
    });

    const adapter = new ShopifyAdapter();

    await expect(adapter.fetchProduct('https://northwind.myshopify.com/products/incomplete')).rejects.toThrow(
      'Unable to parse Shopify product metadata from JSON API. Missing: price'
    );
  });
});
