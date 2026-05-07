(function productDetectionFactory(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UniversalCartProductDetection = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createProductDetection() {
  function asArray(value) {
    return Array.isArray(value) ? value : [value].filter(Boolean);
  }

  function flattenJsonLdEntries(value) {
    const entries = [];
    for (const item of asArray(value)) {
      if (!item || typeof item !== 'object') continue;
      entries.push(item);
      if (item['@graph']) {
        entries.push(...flattenJsonLdEntries(item['@graph']));
      }
    }
    return entries;
  }

  function productFromJsonLdEntry(entry) {
    const types = asArray(entry?.['@type']).map((type) => String(type).toLowerCase());
    if (!types.includes('product')) return null;

    const offers = asArray(entry.offers)[0] || {};
    return {
      title: entry.name || '',
      price: offers.price || entry.price || '',
      image: asArray(entry.image)[0] || '',
      sku: entry.sku || entry.mpn || '',
      brand: typeof entry.brand === 'string' ? entry.brand : entry.brand?.name || '',
      availability: offers.availability || '',
    };
  }

  function findJsonLdProduct(documentRef) {
    const scripts = Array.from(documentRef.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || '{}');
        for (const entry of flattenJsonLdEntries(parsed)) {
          const product = productFromJsonLdEntry(entry);
          if (product) return product;
        }
      } catch {
        // Ignore malformed structured data from retailer pages.
      }
    }

    return null;
  }

  function getMetaContent(documentRef, ...selectors) {
    for (const selector of selectors) {
      const value = documentRef.querySelector(selector)?.getAttribute('content');
      if (value) return value.trim();
    }
    return '';
  }

  function normalizePrice(value) {
    return String(value || '').replace(/[^0-9.]/g, '');
  }

  function getProductInfo(documentRef, locationRef) {
    const structuredProduct = findJsonLdProduct(documentRef);
    const hostname = locationRef?.hostname || '';
    const pathname = locationRef?.pathname || '';

    let title = structuredProduct?.title || getMetaContent(documentRef, 'meta[property="og:title"]', 'meta[name="twitter:title"]');
    let price = structuredProduct?.price || getMetaContent(documentRef, 'meta[property="product:price:amount"]', 'meta[name="twitter:data1"]');
    let image = structuredProduct?.image || getMetaContent(documentRef, 'meta[property="og:image"]', 'meta[name="twitter:image"]');
    let sku = structuredProduct?.sku || '';
    let brand = structuredProduct?.brand || '';
    const availability = structuredProduct?.availability || '';

    if (!title && hostname.includes('amazon')) {
      title = documentRef.querySelector('#productTitle')?.innerText?.trim() || '';
      price = documentRef.querySelector('.a-price .a-offscreen')?.innerText ||
        documentRef.querySelector('.a-price-whole')?.innerText ||
        '';
      image = documentRef.querySelector('#imgTagWrapperId img')?.src || '';
      sku = pathname.match(/\/dp\/([^/?]+)/)?.[1] || sku;
    } else if (!title && hostname.includes('walmart')) {
      title = documentRef.querySelector('[data-testid="product-title"]')?.innerText?.trim() || '';
      price = documentRef.querySelector('[data-testid="price-wrap"]')?.innerText ||
        documentRef.querySelector('[data-testid="price"]')?.innerText ||
        '';
      image = documentRef.querySelector('img[data-testid="hero-image"]')?.src || '';
    } else if (!title && hostname.includes('target')) {
      title = documentRef.querySelector('[data-test="product-title"]')?.innerText?.trim() || '';
      price = documentRef.querySelector('[data-test="product-price"]')?.innerText || '';
      image = documentRef.querySelector('img[data-test="product-image"]')?.src || '';
    } else if (!title && hostname.includes('macys')) {
      title = documentRef.querySelector('[data-auto="product-name"]')?.innerText?.trim() ||
        documentRef.querySelector('.product-title')?.innerText?.trim() ||
        '';
      price = documentRef.querySelector('[data-auto="price"]')?.innerText ||
        documentRef.querySelector('.price')?.innerText ||
        '';
      image = documentRef.querySelector('[data-auto="product-image"] img')?.src ||
        documentRef.querySelector('.main-image img')?.src ||
        '';
      sku = locationRef?.href?.match(/[?&]ID=(\d+)/i)?.[1] || sku;
    } else if (!title && hostname.includes('bestbuy')) {
      title = documentRef.querySelector('.sku-title')?.innerText?.trim() ||
        documentRef.querySelector('[data-testid="product-title"]')?.innerText?.trim() ||
        '';
      price = documentRef.querySelector('.priceView-customer-price span')?.innerText ||
        documentRef.querySelector('[data-testid="customer-price"]')?.innerText ||
        '';
      image = documentRef.querySelector('.primary-image')?.src ||
        documentRef.querySelector('[data-testid="primary-image"]')?.src ||
        '';
      sku = documentRef.querySelector('.sku.product-data')?.innerText?.replace(/^sku\s*:\s*/i, '').replace(/[^0-9A-Za-z-]/g, '').trim() ||
        pathname.match(/\/(\d+)\.p/)?.[1] ||
        sku;
    } else if (!title && (hostname.includes('myshopify.com') || documentRef.querySelector('form[action*="/cart/add"]'))) {
      title = documentRef.querySelector('[data-product-title]')?.innerText?.trim() ||
        documentRef.querySelector('.product__title')?.innerText?.trim() ||
        documentRef.querySelector('h1')?.innerText?.trim() ||
        '';
      price = documentRef.querySelector('[data-product-price]')?.innerText ||
        documentRef.querySelector('.price-item--regular')?.innerText ||
        documentRef.querySelector('.price')?.innerText ||
        '';
      image = documentRef.querySelector('[data-product-featured-image]')?.src ||
        documentRef.querySelector('.product__media img')?.src ||
        documentRef.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
        '';
    }

    if (!title) {
      const h1 = documentRef.querySelector('h1');
      if (h1) title = h1.innerText.trim();
      const priceElem = documentRef.querySelector('[class*="price"], [class*="Price"]');
      if (priceElem) price = priceElem.innerText;
    }

    return {
      title,
      price: normalizePrice(price),
      image,
      sku,
      brand,
      availability,
      retailer: hostname,
      url: locationRef?.href || '',
    };
  }

  function productSignature(productInfo) {
    return [
      productInfo.title || '',
      productInfo.price || '',
      productInfo.sku || '',
      productInfo.url || '',
    ].join('|');
  }

  function observeProductChanges(documentRef, locationRef, onChange, options = {}) {
    const windowRef = options.windowRef || documentRef?.defaultView || globalThis;
    const Observer = options.MutationObserver || windowRef?.MutationObserver;
    const body = documentRef?.body || documentRef?.documentElement;

    if (!Observer || !body || typeof onChange !== 'function') {
      return function noopDisconnect() {};
    }

    const debounceMs = Number(options.debounceMs ?? 500);
    let timeoutId = null;
    let lastSignature = productSignature(getProductInfo(documentRef, locationRef));

    function runDetection() {
      timeoutId = null;
      const productInfo = getProductInfo(documentRef, locationRef);
      const nextSignature = productSignature(productInfo);
      if (nextSignature === lastSignature) return;
      lastSignature = nextSignature;
      onChange(productInfo);
    }

    function scheduleDetection() {
      if (timeoutId) windowRef.clearTimeout(timeoutId);
      timeoutId = windowRef.setTimeout(runDetection, debounceMs);
    }

    const observer = new Observer(scheduleDetection);
    observer.observe(body, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });

    return function disconnectProductObserver() {
      if (timeoutId) windowRef.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }

  return {
    asArray,
    findJsonLdProduct,
    getProductInfo,
    normalizePrice,
    observeProductChanges,
  };
});
