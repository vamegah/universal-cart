import axios from 'axios';
import { BaseRetailerAdapter } from '../baseAdapter';
import { extractJsonLdMetadata, parseJsonLd, parsePrice, safeMatch } from '../productParser';

export class BestBuyAdapter extends BaseRetailerAdapter {
  async fetchProduct(url: string) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const html = response.data as string;
    const structured = extractJsonLdMetadata(parseJsonLd(html));

    const name =
      safeMatch(html, /<h1[^>]*data-testid=["']product-title["'][^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /<h1[^>]*class=["'][^"']*heading[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /<h1[^>]*class=["'][^"']*product-title[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      safeMatch(html, /"name"\s*:\s*"([^"]+)"/i) ||
      structured.name;

    const priceText =
      safeMatch(html, /<div[^>]*data-testid=["']customer-price["'][^>]*>([^<]+)<\/div>/i) ||
      safeMatch(html, /<span[^>]*data-testid=["']customer-price["'][^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /<div[^>]*class=["'][^"']*priceView-customer-price[^"']*["'][^>]*>\s*<span[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /"currentPrice"\s*:\s*"?([\d.,]+)"?/i) ||
      safeMatch(html, /"price"\s*:\s*"?([\d.,]+)"?/i);

    const image =
      safeMatch(html, /property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      safeMatch(html, /<img[^>]*class=["'][^"']*primary-image[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
      safeMatch(html, /"primaryImage"\s*:\s*"([^"]+)"/i) ||
      safeMatch(html, /"image"\s*:\s*"([^"]+)"/i) ||
      structured.image;

    const sku =
      safeMatch(html, /"skuId"\s*:\s*"([^"]+)"/i) ||
      safeMatch(html, /"sku"\s*:\s*"([^"]+)"/i) ||
      safeMatch(html, /"productSku"\s*:\s*"([^"]+)"/i) ||
      safeMatch(html, /\/site\/[^/]+\/([0-9]+)\.p/i) ||
      structured.sku;

    const brand =
      safeMatch(html, /"brand"\s*:\s*"([^"]+)"/i) ||
      safeMatch(html, /<span[^>]*class=["'][^"']*sku-title[^"']*["'][^>]*>\s*([^<]+)<\/span>/i) ||
      structured.brand;

    const availability =
      safeMatch(html, /"availability"\s*:\s*"([^"]+)"/i) ||
      safeMatch(html, /<button[^>]*data-testid=["']add-to-cart["'][^>]*>([^<]+)<\/button>/i) ||
      structured.availability;

    const price = parsePrice(priceText) ?? structured.price;
    const missing = [
      !name ? 'name' : null,
      price == null ? 'price' : null,
      !sku ? 'sku' : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(`Unable to parse Best Buy product metadata from the provided URL. Missing: ${missing.join(', ')}.`);
    }

    return {
      name,
      price,
      sku,
      image,
      sourceUrl: url,
      brand: brand || undefined,
      model: structured.model || undefined,
      upc: structured.upc || undefined,
      category: structured.category || undefined,
      attributes: structured.attributes || undefined,
      availability: availability || undefined,
      rawMetadata: structured.rawMetadata || undefined,
    };
  }

  async addToCart(productId: string, quantity: number) {
    return `https://www.bestbuy.com/cart/add?product_id=${encodeURIComponent(productId)}&qty=${quantity}`;
  }
}
