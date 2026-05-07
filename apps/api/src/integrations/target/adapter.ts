import axios from 'axios';
import { BaseRetailerAdapter } from '../baseAdapter';
import { extractJsonLdMetadata, parseJsonLd, parsePrice, safeMatch } from '../productParser';

export class TargetAdapter extends BaseRetailerAdapter {
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
      safeMatch(html, /<h1[^>]*data-test="product-title"[^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /<h1[^>]*class=".*ProductTitle.*"[^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /"itemName":"([^\"]+)"/i) ||
      structured.name;

    const priceText =
      safeMatch(html, /"currentPrice":\s*\{[^}]*"price":\s*"?([\d.,]+)"?/i) ||
      safeMatch(html, /<span[^>]*data-test="product-price"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /"formattedCurrentPrice":"([^\"]+)"/i);

    const image =
      safeMatch(html, /<img[^>]*data-test="hero-image"[^>]*src="([^\"]+)"/i) ||
      safeMatch(html, /"primaryImageUrl":"([^\"]+)"/i) ||
      safeMatch(html, /property="og:image" content="([^\"]+)"/i) ||
      structured.image;

    const sku =
      safeMatch(html, /"itemId":"([^\"]+)"/i) ||
      safeMatch(html, /<span[^>]*data-test="product-id"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /"tcin":"([^\"]+)"/i) ||
      structured.sku;

    const brand =
      safeMatch(html, /"brand":"([^\"]+)"/i) ||
      safeMatch(html, /<a[^>]*data-test="brand"[^>]*>([^<]+)<\/a>/i) ||
      structured.brand;

    const availability =
      safeMatch(html, /"availability":"([^\"]+)"/i) ||
      safeMatch(html, /<div[^>]*data-test="purchase-fulfillment"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i) ||
      structured.availability;

    const price = parsePrice(priceText) ?? structured.price;
    if (!name || price === null || !sku) {
      throw new Error('Unable to parse Target product metadata from the provided URL.');
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
    return `https://www.target.com/cart?product_id=${encodeURIComponent(productId)}&quantity=${quantity}`;
  }
}
