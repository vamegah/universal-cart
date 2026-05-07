import axios from 'axios';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AmazonAdapter } from '../../apps/api/src/integrations/amazon/adapter';
import { BestBuyAdapter } from '../../apps/api/src/integrations/bestbuy/adapter';
import { MacysAdapter } from '../../apps/api/src/integrations/macys/adapter';
import { ShopifyAdapter } from '../../apps/api/src/integrations/shopify/adapter';
import { TargetAdapter } from '../../apps/api/src/integrations/target/adapter';
import { WalmartAdapter } from '../../apps/api/src/integrations/walmart/adapter';

jest.mock('axios');

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

function productJsonLd(name: string, price: string, sku: string, image: string, brand: string) {
  return `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@type": "Product",
            "name": "${name}",
            "sku": "${sku}",
            "image": "${image}",
            "brand": { "name": "${brand}" },
            "offers": { "price": "${price}", "availability": "https://schema.org/InStock" }
          }
        </script>
      </head>
      <body></body>
    </html>
  `;
}

describe('retailer URL adapters', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it.each([
    {
      name: 'Amazon',
      adapter: () => new AmazonAdapter(),
      url: 'https://www.amazon.com/dp/B0ABC12345',
      html: productJsonLd('Amazon Echo Dot', '49.99', 'B0ABC12345', 'https://images.example.com/echo.jpg', 'Amazon'),
      expected: {
        name: 'Amazon Echo Dot',
        price: 49.99,
        sku: 'B0ABC12345',
        image: 'https://images.example.com/echo.jpg',
        brand: 'Amazon',
      },
    },
    {
      name: 'Walmart',
      adapter: () => new WalmartAdapter(),
      url: 'https://www.walmart.com/ip/123456789',
      html: productJsonLd('Walmart AirPods Pro', '189.00', '123456789', 'https://images.example.com/airpods.jpg', 'Apple'),
      expected: {
        name: 'Walmart AirPods Pro',
        price: 189,
        sku: '123456789',
        image: 'https://images.example.com/airpods.jpg',
        brand: 'Apple',
      },
    },
    {
      name: 'Target',
      adapter: () => new TargetAdapter(),
      url: 'https://www.target.com/p/item/-/A-987654321',
      html: productJsonLd('Target Coffee Maker', '79.99', '987654321', 'https://images.example.com/coffee.jpg', 'KitchenAid'),
      expected: {
        name: 'Target Coffee Maker',
        price: 79.99,
        sku: '987654321',
        image: 'https://images.example.com/coffee.jpg',
        brand: 'KitchenAid',
      },
    },
    {
      name: "Macy's",
      adapter: () => new MacysAdapter(),
      url: 'https://www.macys.com/shop/product/555555',
      html: productJsonLd("Macy's Jacket", '129.50', '555555', 'https://images.example.com/jacket.jpg', 'Bar III'),
      expected: {
        name: "Macy's Jacket",
        price: 129.5,
        sku: '555555',
        image: 'https://images.example.com/jacket.jpg',
        brand: 'Bar III',
      },
    },
    {
      name: 'BestBuy',
      adapter: () => new BestBuyAdapter(),
      url: 'https://www.bestbuy.com/site/headphones/6505727.p',
      html: productJsonLd('Best Buy Headphones', '349.99', '6505727', 'https://images.example.com/headphones.jpg', 'Sony'),
      expected: {
        name: 'Best Buy Headphones',
        price: 349.99,
        sku: '6505727',
        image: 'https://images.example.com/headphones.jpg',
        brand: 'Sony',
      },
    },
  ])('$name parses JSON-LD product metadata', async ({ adapter, url, html, expected }) => {
    mockedGet.mockResolvedValue({ data: html });

    const result = await adapter().fetchProduct(url);

    expect(result).toMatchObject({
      ...expected,
      sourceUrl: url,
      availability: 'https://schema.org/InStock',
    });
  });

  it('Shopify parses the product JSON endpoint', async () => {
    mockedGet.mockResolvedValue({
      data: {
        product: {
          id: 111,
          title: 'Shopify Backpack',
          vendor: 'Topo',
          image: { src: 'https://cdn.example.com/backpack.jpg' },
          variants: [
            {
              id: 222,
              sku: 'BAG-BLACK',
              price: '88.00',
              available: true,
            },
          ],
        },
      },
    });

    const result = await new ShopifyAdapter().fetchProduct('https://store.myshopify.com/products/backpack');

    expect(result).toMatchObject({
      name: 'Shopify Backpack',
      price: 88,
      sku: 'BAG-BLACK',
      image: 'https://cdn.example.com/backpack.jpg',
      brand: 'Topo',
      availability: 'InStock',
      sourceUrl: 'https://store.myshopify.com/products/backpack',
    });
  });
});
