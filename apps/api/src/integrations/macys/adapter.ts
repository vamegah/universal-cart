import axios from 'axios';
import { BaseRetailerAdapter } from '../baseAdapter';
import { extractJsonLdMetadata, parseJsonLd, parsePrice, safeMatch } from '../productParser';

export class MacysAdapter extends BaseRetailerAdapter {
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
      safeMatch(html, /<h1[^>]*class=".*product-title.*"[^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /property="og:title" content="([^\"]+)"/i) ||
      safeMatch(html, /"productName":"([^\"]+)"/i) ||
      structured.name;

    const priceText =
      safeMatch(html, /<span[^>]*class="price"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /"price":\s*"?([\d.,]+)"?/i) ||
      safeMatch(html, /"currentPrice":\s*\{[^}]*"amount":\s*"?([\d.,]+)"?/i);

    const image =
      safeMatch(html, /property="og:image" content="([^\"]+)"/i) ||
      safeMatch(html, /"primaryImageUrl":"([^\"]+)"/i) ||
      safeMatch(html, /<img[^>]*class=".*product-image.*"[^>]*src="([^\"]+)"/i) ||
      structured.image;

    const sku =
      safeMatch(html, /"sku":"([^\"]+)"/i) ||
      safeMatch(html, /productId=([0-9A-Za-z-]+)/i) ||
      safeMatch(html, /<span[^>]*class="sku"[^>]*>([^<]+)<\/span>/i) ||
      structured.sku;

    const brand =
      safeMatch(html, /"brand":"([^\"]+)"/i) ||
      safeMatch(html, /<span[^>]*class="brand"[^>]*>([^<]+)<\/span>/i) ||
      structured.brand;

    const availability =
      safeMatch(html, /"availability":"([^\"]+)"/i) ||
      safeMatch(html, /<div[^>]*class="availability"[^>]*>\s*([^<]+)<\/div>/i) ||
      structured.availability;

    const price = parsePrice(priceText) ?? structured.price;
    if (!name || price === null || !sku) {
      throw new Error("Unable to parse Macy's product metadata from the provided URL.");
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
    return `https://www.macys.com/cart/add?product_id=${encodeURIComponent(productId)}&qty=${quantity}`;
  }
}
