const { getProductInfo, normalizePrice, observeProductChanges } = require('../../apps/extension/product-detection');

function element({ text = '', content = '', src = '' } = {}) {
  return {
    textContent: text,
    innerText: text,
    src,
    getAttribute(name) {
      return name === 'content' ? content : '';
    },
  };
}

function documentFixture(selectors) {
  return {
    querySelector(selector) {
      const value = selectors[selector];
      return Array.isArray(value) ? value[0] : value || null;
    },
    querySelectorAll(selector) {
      const value = selectors[selector];
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    },
  };
}

function locationFixture(url) {
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    href: parsed.href,
  };
}

describe('extension product detection', () => {
  it('normalizes prices from formatted retailer text', () => {
    expect(normalizePrice('$1,299.99')).toBe('1299.99');
    expect(normalizePrice('Now USD 42.50')).toBe('42.50');
  });

  it('extracts JSON-LD product data before retailer-specific selectors', () => {
    const doc = documentFixture({
      'script[type="application/ld+json"]': element({
        text: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Sony WH-1000XM5 Headphones',
          image: ['https://example.com/sony.jpg'],
          sku: 'XM5-BLK',
          brand: { name: 'Sony' },
          offers: {
            '@type': 'Offer',
            price: '328.00',
            availability: 'https://schema.org/InStock',
          },
        }),
      }),
    });

    const product = getProductInfo(doc, locationFixture('https://www.bestbuy.com/site/sony/123'));

    expect(product).toMatchObject({
      title: 'Sony WH-1000XM5 Headphones',
      price: '328.00',
      image: 'https://example.com/sony.jpg',
      sku: 'XM5-BLK',
      brand: 'Sony',
      availability: 'https://schema.org/InStock',
      retailer: 'www.bestbuy.com',
    });
  });

  it('falls back to OpenGraph and product price meta tags', () => {
    const doc = documentFixture({
      'script[type="application/ld+json"]': element({ text: '{bad json' }),
      'meta[property="og:title"]': element({ content: 'KitchenAid Mixer' }),
      'meta[property="product:price:amount"]': element({ content: '449.95' }),
      'meta[property="og:image"]': element({ content: 'https://example.com/mixer.png' }),
    });

    const product = getProductInfo(doc, locationFixture('https://shop.example.com/products/mixer'));

    expect(product.title).toBe('KitchenAid Mixer');
    expect(product.price).toBe('449.95');
    expect(product.image).toBe('https://example.com/mixer.png');
  });

  it('uses Amazon selectors and derives the ASIN from the path', () => {
    const doc = documentFixture({
      '#productTitle': element({ text: 'Echo Dot Smart Speaker' }),
      '.a-price .a-offscreen': element({ text: '$49.99' }),
      '#imgTagWrapperId img': element({ src: 'https://images.example.com/echo.jpg' }),
    });

    const product = getProductInfo(doc, locationFixture('https://www.amazon.com/dp/B09B8V1LZ3'));

    expect(product.title).toBe('Echo Dot Smart Speaker');
    expect(product.price).toBe('49.99');
    expect(product.image).toBe('https://images.example.com/echo.jpg');
    expect(product.sku).toBe('B09B8V1LZ3');
  });

  it('uses Walmart and Target selector fallbacks', () => {
    const walmart = getProductInfo(
      documentFixture({
        '[data-testid="product-title"]': element({ text: 'Walmart Coffee Beans' }),
        '[data-testid="price-wrap"]': element({ text: '$13.48' }),
        'img[data-testid="hero-image"]': element({ src: 'https://i.example.com/coffee.jpg' }),
      }),
      locationFixture('https://www.walmart.com/ip/coffee/111')
    );
    const target = getProductInfo(
      documentFixture({
        '[data-test="product-title"]': element({ text: 'Target Bath Towels' }),
        '[data-test="product-price"]': element({ text: '$24.00' }),
        'img[data-test="product-image"]': element({ src: 'https://i.example.com/towels.jpg' }),
      }),
      locationFixture('https://www.target.com/p/towels/-/A-222')
    );

    expect(walmart).toMatchObject({
      title: 'Walmart Coffee Beans',
      price: '13.48',
      image: 'https://i.example.com/coffee.jpg',
    });
    expect(target).toMatchObject({
      title: 'Target Bath Towels',
      price: '24.00',
      image: 'https://i.example.com/towels.jpg',
    });
  });

  it('uses Macy selector fallbacks and derives the listing id', () => {
    const product = getProductInfo(
      documentFixture({
        '[data-auto="product-name"]': element({ text: 'Macy Wool Coat' }),
        '[data-auto="price"]': element({ text: '$129.50' }),
        '[data-auto="product-image"] img': element({ src: 'https://i.example.com/coat.jpg' }),
      }),
      locationFixture('https://www.macys.com/shop/product/wool-coat?ID=987654')
    );

    expect(product).toMatchObject({
      title: 'Macy Wool Coat',
      price: '129.50',
      image: 'https://i.example.com/coat.jpg',
      sku: '987654',
    });
  });

  it('uses Best Buy selector fallbacks and extracts the numeric sku', () => {
    const product = getProductInfo(
      documentFixture({
        '.sku-title': element({ text: 'Best Buy Bluetooth Speaker' }),
        '.priceView-customer-price span': element({ text: '$79.99' }),
        '.primary-image': element({ src: 'https://i.example.com/speaker.jpg' }),
        '.sku.product-data': element({ text: 'SKU: 1234567' }),
      }),
      locationFixture('https://www.bestbuy.com/site/speaker/1234567.p')
    );

    expect(product).toMatchObject({
      title: 'Best Buy Bluetooth Speaker',
      price: '79.99',
      image: 'https://i.example.com/speaker.jpg',
      sku: '1234567',
    });
  });

  it('uses Shopify/generic product selector fallbacks', () => {
    const product = getProductInfo(
      documentFixture({
        'form[action*="/cart/add"]': element(),
        '[data-product-title]': element({ text: 'Shopify Ceramic Mug' }),
        '[data-product-price]': element({ text: '$18.00' }),
        '[data-product-featured-image]': element({ src: 'https://i.example.com/mug.jpg' }),
      }),
      locationFixture('https://demo-shop.myshopify.com/products/mug')
    );

    expect(product).toMatchObject({
      title: 'Shopify Ceramic Mug',
      price: '18.00',
      image: 'https://i.example.com/mug.jpg',
      retailer: 'demo-shop.myshopify.com',
    });
  });

  it('debounces product change detection for dynamic product pages', () => {
    jest.useFakeTimers();
    const title = element({ text: 'Original Lamp' });
    const price = element({ text: '$19.99' });
    const selectors = {
      h1: title,
      '[class*="price"], [class*="Price"]': price,
    };
    const doc = documentFixture(selectors);
    doc.body = {};

    let observerCallback;
    class FakeMutationObserver {
      constructor(callback) {
        observerCallback = callback;
      }
      observe = jest.fn();
      disconnect = jest.fn();
    }

    const onChange = jest.fn();
    const disconnect = observeProductChanges(
      doc,
      locationFixture('https://shop.example.com/products/lamp'),
      onChange,
      {
        debounceMs: 500,
        windowRef: {
          MutationObserver: FakeMutationObserver,
          setTimeout,
          clearTimeout,
        },
      }
    );

    title.innerText = 'Updated Lamp';
    price.innerText = '$14.99';
    observerCallback();

    jest.advanceTimersByTime(499);
    expect(onChange).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated Lamp',
        price: '14.99',
      })
    );

    disconnect();
    jest.useRealTimers();
  });
});
