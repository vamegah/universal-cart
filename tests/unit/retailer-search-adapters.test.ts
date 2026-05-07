import axios from 'axios';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AmazonAdapter } from '../../apps/api/src/integrations/amazon/adapter';
import { WalmartAdapter } from '../../apps/api/src/integrations/walmart/adapter';

jest.mock('axios');

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

describe('retailer search adapters', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('extracts Amazon search results from product tiles', async () => {
    mockedGet.mockResolvedValue({
      data: `
        <html><body>
          <div data-asin="B0ABC12345" data-component-type="s-search-result">
            <h2><a class="a-link-normal" href="/Echo-Dot/dp/B0ABC12345"><span>Echo Dot Smart Speaker</span></a></h2>
            <span class="a-price-whole">49</span><span class="a-price-fraction">99</span>
            <img class="s-image" src="https://images.example.com/echo.jpg">
          </div>
        </body></html>
      `,
    });

    const results = await new AmazonAdapter().searchProducts('echo dot');

    expect(mockedGet).toHaveBeenCalledWith(
      'https://www.amazon.com/s?k=echo%20dot',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining('text/html'),
        }),
      })
    );
    expect(results).toEqual([
      expect.objectContaining({
        name: 'Echo Dot Smart Speaker',
        price: 49.99,
        sku: 'B0ABC12345',
        image: 'https://images.example.com/echo.jpg',
        sourceUrl: 'https://www.amazon.com/dp/B0ABC12345',
      }),
    ]);
  });

  it('extracts Walmart search results from product tiles', async () => {
    mockedGet.mockResolvedValue({
      data: `
        <html><body>
          <div data-item-id="123456789">
            <a href="/ip/Apple-AirPods-Pro/123456789">
              <span data-automation-id="product-title">Apple AirPods Pro</span>
            </a>
            <div data-automation-id="product-price">$189.00</div>
            <img data-testid="productTileImage" src="https://images.example.com/airpods.jpg">
          </div>
        </body></html>
      `,
    });

    const results = await new WalmartAdapter().searchProducts('airpods pro');

    expect(mockedGet).toHaveBeenCalledWith(
      'https://www.walmart.com/search?q=airpods%20pro',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining('text/html'),
        }),
      })
    );
    expect(results).toEqual([
      expect.objectContaining({
        name: 'Apple AirPods Pro',
        price: 189,
        sku: '123456789',
        image: 'https://images.example.com/airpods.jpg',
        sourceUrl: 'https://www.walmart.com/ip/Apple-AirPods-Pro/123456789',
      }),
    ]);
  });
});
