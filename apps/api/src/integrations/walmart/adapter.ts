import axios from 'axios';
import { BaseRetailerAdapter, ProductSearchResult } from '../baseAdapter';
import { extractJsonLdMetadata, parseJsonLd, parsePrice, safeMatch } from '../productParser';

export class WalmartAdapter extends BaseRetailerAdapter {
  private readonly headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  async fetchProduct(url: string) {
    const response = await axios.get(url, {
      headers: this.headers,
    });

    const html = response.data as string;
    const structured = extractJsonLdMetadata(parseJsonLd(html));

    const name =
      safeMatch(html, /<h1[^>]*class=".*prod-ProductTitle.*"[^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /<h1[^>]*data-testid="product-title"[^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /"productName"\s*:\s*"([^\"]+)"/i) ||
      structured.name;

    const priceText =
      safeMatch(html, /"price":"([^\"]+)"/i) ||
      safeMatch(html, /<span[^>]*class="price-group"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /"price":\s*\{[^}]*"amount":\s*"?([\d.,]+)"?/i);

    const image =
      safeMatch(html, /"media"\s*:\s*\[\s*\{[^}]*"uri":"([^\"]+)"/i) ||
      safeMatch(html, /<img[^>]*class=".*preview.*"[^>]*src="([^\"]+)"/i) ||
      safeMatch(html, /"imageUrl":"([^\"]+)"/i) ||
      structured.image;

    const sku =
      safeMatch(html, /"itemId":"([^\"]+)"/i) ||
      safeMatch(html, /<input[^>]*name="itemId"[^>]*value="([^\"]+)"/i) ||
      safeMatch(html, /wmls.*\/([0-9A-Za-z-]+)\/p/i) ||
      structured.sku;

    const brand = safeMatch(html, /"brand":"([^\"]+)"/i) || structured.brand;
    const availability =
      safeMatch(html, /"availability":"([^\"]+)"/i) ||
      safeMatch(html, /<div[^>]*class=".*prod-ProductOffer.*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i) ||
      structured.availability;

    const price = parsePrice(priceText) ?? structured.price;
    if (!name || price === null || !sku) {
      throw new Error('Unable to parse Walmart product metadata from the provided URL.');
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
    return `https://www.walmart.com/cart/add?product_id=${encodeURIComponent(productId)}&qty=${quantity}`;
  }

  async searchProducts(query: string): Promise<ProductSearchResult[]> {
    const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, { headers: this.headers });
    const html = response.data as string;
    const results: ProductSearchResult[] = [];
    const seen = new Set<string>();
    const itemRegex = /<div[^>]*(?:data-item-id|data-testid)=["']([^"']+)["'][^>]*>([\s\S]*?)(?=<div[^>]*(?:data-item-id|data-testid)=["'][^"']+["']|<\/body>|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(html)) !== null && results.length < 10) {
      const block = match[2];
      const explicitSku = match[1]?.match(/[0-9A-Za-z-]{4,}/)?.[0] || null;
      const sku =
        safeMatch(block, /"itemId"\s*:\s*"([^"]+)"/i) ||
        safeMatch(block, /\/ip\/[^"']+\/([0-9A-Za-z-]+)(?:[?"']|$)/i) ||
        explicitSku;
      if (!sku || seen.has(sku)) continue;

      const name =
        safeMatch(block, /<span[^>]*data-automation-id=["']product-title["'][^>]*>([^<]+)<\/span>/i) ||
        safeMatch(block, /<a[^>]*link-identifier=["'][^"']*["'][^>]*>([^<]+)<\/a>/i) ||
        safeMatch(block, /"name"\s*:\s*"([^"]+)"/i);
      const priceText =
        safeMatch(block, /<div[^>]*data-automation-id=["']product-price["'][^>]*>([^<]+)<\/div>/i) ||
        safeMatch(block, /"price"\s*:\s*"?([\d.,]+)"?/i) ||
        safeMatch(block, /"currentPrice"\s*:\s*\{[^}]*"price"\s*:\s*"?([\d.,]+)"?/i);
      const price = parsePrice(priceText);
      if (!name || price == null) continue;

      const href = safeMatch(block, /<a[^>]*href=["']([^"']*\/ip\/[^"']+)["']/i);
      const image =
        safeMatch(block, /<img[^>]*data-testid=["']productTileImage["'][^>]*src=["']([^"']+)["']/i) ||
        safeMatch(block, /"image"\s*:\s*"([^"]+)"/i);

      seen.add(sku);
      results.push({
        name,
        price,
        sku,
        image: image || undefined,
        sourceUrl: href?.startsWith('http') ? href : `https://www.walmart.com${href || `/ip/${sku}`}`,
        rawMetadata: { searchUrl },
      });
    }

    return results;
  }
}
